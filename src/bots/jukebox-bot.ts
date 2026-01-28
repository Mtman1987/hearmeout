
import 'dotenv/config';
import { db } from '@/firebase/admin';
import { Room, RoomEvent, RoomServiceClient, LocalTrack, AudioPresets, AccessToken } from 'livekit-server-sdk';
import ytdl from 'ytdl-core';
import { PassThrough } from 'stream';

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
const livekitApiKey = process.env.LIVEKIT_API_KEY;
const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
const targetRoomId = process.env.TARGET_ROOM_ID;

if (!livekitUrl || !livekitApiKey || !livekitApiSecret || !targetRoomId) {
    console.error("Missing required LiveKit or Room environment variables. Please check your .env file.");
    process.exit(1);
}

const roomService = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);
let room: Room;
let publishedTrack: LocalTrack | null = null;
let broadcastStream: PassThrough | null = null;
let currentSongStream: ReturnType<typeof ytdl> | null = null;

async function connectAndPublish() {
    try {
        room = new Room();

        console.log(`Attempting to connect to LiveKit room: ${targetRoomId}`);
        
        // This is the persistent stream that we will publish.
        broadcastStream = new PassThrough();

        // Listen for events.
        room.on(RoomEvent.Connected, async () => {
            console.log(`Successfully connected to room: ${room.name}`);
            console.log(`Bot connected with identity: ${room.localParticipant.identity}`);

            // Publish the single, persistent track.
            publishedTrack = await room.localParticipant.publishTrack(broadcastStream!, {
                name: 'jukebox-audio',
                source: 'unknown',
                audioPreset: AudioPresets.musicHighQuality,
            });
            console.log(`Published persistent Jukebox track with SID: ${publishedTrack.sid}`);
            listenToFirestore(); // Start listening for commands AFTER publishing the track.
        });
        
        room.on(RoomEvent.Disconnected, () => {
            console.log('Bot disconnected from the room.');
            // You might want to add reconnection logic here.
        });

        const token = new AccessToken(livekitApiKey, livekitApiSecret, {
            identity: 'jukebox',
            name: 'Jukebox',
        });
        token.addGrant({ room: targetRoomId, roomJoin: true, canPublish: true, canSubscribe: false });
        
        await room.connect(livekitUrl, token.toJwt());

    } catch (error) {
        console.error("Failed to connect or publish to LiveKit room:", error);
        process.exit(1);
    }
}

function streamSong(url: string) {
    // If another song is already streaming, destroy its source stream.
    if (currentSongStream) {
        currentSongStream.destroy();
        currentSongStream = null;
    }

    if (!broadcastStream) {
        console.error("Broadcast stream is not initialized. Cannot play song.");
        return;
    }

    console.log(`Starting to stream new song from ${url}`);

    try {
        currentSongStream = ytdl(url, {
            quality: 'highestaudio',
            filter: 'audioonly',
        });

        currentSongStream.on('error', (err) => {
            console.error('Error with song stream:', err.message);
        });

        currentSongStream.on('end', () => {
            console.log(`Song from ${url} finished streaming.`);
        });

        // Pipe the new song's audio into our long-lived broadcast stream.
        // `end: false` prevents the song stream from closing our broadcast stream when it finishes.
        currentSongStream.pipe(broadcastStream, { end: false });

    } catch (error) {
        console.error("Error creating ytdl stream:", error);
    }
}

function stopStreaming() {
    if (currentSongStream) {
        console.log("Stopping current song stream.");
        // Unpipe to stop feeding the broadcast stream, but don't destroy the broadcast stream itself.
        currentSongStream.unpipe(broadcastStream!);
        currentSongStream.destroy();
        currentSongStream = null;
    }
}

function listenToFirestore() {
    const roomRef = db.collection('rooms').doc(targetRoomId!);

    let lastTrackId: string | null = null;
    let lastIsPlaying: boolean = false;

    roomRef.onSnapshot(async (doc) => {
        if (!doc.exists) {
            console.log("Target room does not exist. Stopping stream.");
            stopStreaming();
            return;
        }

        const roomData = doc.data();
        const newTrackId = roomData?.currentTrackId;
        const newIsPlaying = roomData?.isPlaying;

        // Case 1: Playback is stopped/paused.
        if (newIsPlaying === false && lastIsPlaying === true) {
            console.log("Firestore state changed to 'paused'. Stopping stream feed.");
            stopStreaming();
        }
        
        // Case 2: Playback starts or the track changes while already playing.
        else if (newIsPlaying === true && (newTrackId !== lastTrackId || lastIsPlaying === false)) {
            const playlistItem = roomData?.playlist?.find((item: any) => item.id === newTrackId);
            if (playlistItem && playlistItem.url) {
                console.log(`Firestore state changed. Streaming track: ${playlistItem.title}`);
                streamSong(playlistItem.url);
            } else {
                console.log(`Track ${newTrackId} requested but not found in playlist.`);
                stopStreaming();
            }
        }

        lastTrackId = newTrackId;
        lastIsPlaying = newIsPlaying;

    }, (err) => {
        console.error("Error listening to Firestore:", err);
    });
}

async function main() {
    await connectAndPublish();
    console.log(`Jukebox bot is initializing for room: ${targetRoomId}`);
}

main();

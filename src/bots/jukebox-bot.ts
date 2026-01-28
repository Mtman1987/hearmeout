
import 'dotenv/config';
import { db } from '@/firebase/admin';
import { Room, RoomEvent, RoomServiceClient, LocalTrack, AudioPresets } from 'livekit-server-sdk';
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
const room = new Room(roomService, targetRoomId, {
    name: 'Jukebox',
    identity: 'jukebox', // CRITICAL FIX: Identify the bot as 'jukebox'
});

let currentTrack: LocalTrack | null = null;
let currentStream: PassThrough | null = null;
let isPlaying = false;
let currentTrackId: string | null = null;

async function connectToRoom() {
    try {
        console.log(`Attempting to connect to LiveKit room: ${targetRoomId}`);
        await room.connect();
        console.log(`Successfully connected to room: ${room.name}`);
        console.log(`Bot connected with identity: ${room.localParticipant.identity}`);
        
        // Listen for remote participants disconnecting
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
            console.log(`Participant disconnected: ${participant.identity}`);
        });

    } catch (error) {
        console.error("Failed to connect to LiveKit room:", error);
        process.exit(1);
    }
}

function stopCurrentTrack() {
    if (currentTrack) {
        console.log("Stopping current track publication.");
        room.localParticipant.unpublishTrack(currentTrack.sid!);
        currentTrack = null;
    }
    if (currentStream) {
        currentStream.destroy();
        currentStream = null;
    }
    isPlaying = false;
}

async function playTrack(trackId: string, url: string) {
    if (!ytdl.validateURL(url)) {
        console.error(`Invalid YouTube URL: ${url}`);
        return;
    }

    stopCurrentTrack();
    currentTrackId = trackId;

    console.log(`Starting to play track: ${trackId} from ${url}`);

    try {
        const stream = ytdl(url, {
            quality: 'highestaudio',
            filter: 'audioonly',
        });
        
        currentStream = new PassThrough();
        stream.pipe(currentStream);

        currentTrack = await room.localParticipant.publishTrack(currentStream, {
            name: 'jukebox-audio',
            source: 'unknown',
            audioPreset: AudioPresets.musicHighQuality,
        });

        console.log(`Published new track with SID: ${currentTrack.sid}`);
        isPlaying = true;
    } catch (error) {
        console.error("Error streaming or publishing track:", error);
        stopCurrentTrack();
    }
}

function listenToFirestore() {
    const roomRef = db.collection('rooms').doc(targetRoomId!);

    roomRef.onSnapshot(async (doc) => {
        if (!doc.exists) {
            console.log("Target room does not exist in Firestore. Shutting down bot for this room.");
            stopCurrentTrack();
            return;
        }

        const roomData = doc.data();
        const newTrackId = roomData?.currentTrackId;
        const newIsPlaying = roomData?.isPlaying;

        // Case 1: Stop playing
        if (newIsPlaying === false && isPlaying === true) {
            console.log("Firestore state changed to not playing. Stopping track.");
            stopCurrentTrack();
            // We set currentTrackId to null so if we play the same song again, it restarts
            currentTrackId = null;
        }
        
        // Case 2: Start playing a new track (or resume a stopped one)
        else if (newIsPlaying === true && newTrackId && newTrackId !== currentTrackId) {
            const playlistItem = roomData?.playlist?.find((item: any) => item.id === newTrackId);
            if (playlistItem && playlistItem.url) {
                console.log(`Firestore state changed. New track requested: ${playlistItem.title}`);
                await playTrack(newTrackId, playlistItem.url);
            } else {
                console.log(`Track ${newTrackId} requested but not found in playlist.`);
            }
        }
    }, (err) => {
        console.error("Error listening to Firestore:", err);
    });
}

async function main() {
    await connectToRoom();
    listenToFirestore();
    console.log(`Jukebox bot is running for room: ${targetRoomId}`);
}

main();

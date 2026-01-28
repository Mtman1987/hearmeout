'use client';

import { useEffect, useRef } from 'react';
import { LiveKitRoom, useLocalParticipant } from '@livekit/components-react';
import { LocalAudioTrack, Track } from 'livekit-client';
import { useToast } from '@/hooks/use-toast';
import { generateLiveKitToken } from '@/app/actions';
import { PlaylistItem } from './Playlist';

interface JukeboxConnectionProps {
    roomData: any;
}

interface RoomData {
  id: string;
  name: string;
  ownerId: string;
  playlist: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
  djId?: string;
  djDisplayName?: string;
}

function JukeboxOrchestrator({ roomData }: { roomData: RoomData }) {
    const { localParticipant } = useLocalParticipant();
    const audioElRef = useRef<HTMLAudioElement>(null);

    const currentTrack = roomData?.playlist?.find((t: any) => t.id === roomData.currentTrackId);

    // Effect to publish the audio stream from the <audio> element
    useEffect(() => {
        if (!localParticipant || !audioElRef.current) return;
        
        const audioElement = audioElRef.current;
        let audioTrack: LocalAudioTrack | null = null;
        let isCleaningUp = false;

        const setupStreamAndPublish = async () => {
            if (isCleaningUp || !localParticipant) return;
            console.log("Jukebox: Setting up stream...");

            try {
                // Get a stream from the audio element.
                const stream = (audioElement as any).captureStream();
                const [track] = stream.getAudioTracks();
                
                if (track) {
                    // Stop and unpublish any previous track
                    if (audioTrack) {
                        await localParticipant.unpublishTrack(audioTrack).catch(e => console.warn("Jukebox: Failed to unpublish old track", e));
                        audioTrack.stop();
                    }

                    audioTrack = new LocalAudioTrack(track, { name: 'jukebox-audio' });
                    await localParticipant.publishTrack(audioTrack, { source: Track.Source.ScreenShareAudio });
                    console.log("Jukebox: Audio track published.");
                }
            } catch (e) {
                console.error("Jukebox: Failed to set up and publish audio track", e);
            }
        };

        audioElement.addEventListener('canplay', setupStreamAndPublish);
        
        return () => {
            isCleaningUp = true;
            audioElement.removeEventListener('canplay', setupStreamAndPublish);
            if (audioTrack && localParticipant) {
                localParticipant.unpublishTrack(audioTrack).catch(console.error);
                audioTrack.stop();
            }
        };
    }, [localParticipant]);

    // Effect to control the audio element's playback state based on Firestore
    useEffect(() => {
        const audio = audioElRef.current;
        if (!audio) return;

        const newSrc = currentTrack?.streamUrl;
        const shouldBePlaying = roomData?.isPlaying && newSrc;

        if (shouldBePlaying) {
            if (audio.src !== newSrc) {
                audio.src = newSrc;
                audio.load(); // this will trigger 'canplay' which triggers the publish effect
            }
            audio.play().catch(e => console.error("Jukebox playback failed:", e));
        } else {
            audio.pause();
        }
    }, [currentTrack, roomData?.isPlaying]);

    return <audio ref={audioElRef} crossOrigin="anonymous" style={{ display: 'none' }} />;
}

export function JukeboxConnection({ roomData }: JukeboxConnectionProps) {
    const { toast } = useToast();
    const [jukeboxToken, setJukeboxToken] = React.useState<string | undefined>(undefined);
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    const roomId = roomData.id;

    useEffect(() => {
        let isCancelled = false;
        const getJukeboxToken = async () => {
            try {
                const token = await generateLiveKitToken(roomId, 'jukebox', 'Jukebox', JSON.stringify({ isJukebox: true }));
                if (!isCancelled) {
                    setJukeboxToken(token);
                }
            } catch(e) {
                console.error("Failed to get jukebox token", e);
                if (!isCancelled) {
                    toast({ variant: 'destructive', title: "Jukebox Error", description: "Could not get connection token for Jukebox."})
                }
            }
        }
        getJukeboxToken();
        return () => { isCancelled = true; }
    }, [roomId, toast]);

    if (!jukeboxToken || !livekitUrl) {
        return null;
    }
    
    return (
        <LiveKitRoom
            serverUrl={livekitUrl}
            token={jukeboxToken}
            connect={true}
            audio={false} 
            video={false}
        >
            <JukeboxOrchestrator roomData={roomData} />
        </LiveKitRoom>
    )
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { LiveKitRoom, useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { LocalAudioTrack, Track } from 'livekit-client';
import { useToast } from '@/hooks/use-toast';
import { generateLiveKitToken } from '@/app/actions';
import { DocumentReference } from 'firebase/firestore';

interface JukeboxConnectionProps {
    roomData: any;
    roomRef: DocumentReference;
}

function JukeboxOrchestrator({ roomData }: { roomData: any }) {
    const { toast } = useToast();
    const { localParticipant } = useLocalParticipant();
    const audioElRef = useRef<HTMLAudioElement>(null);
    const audioTrackRef = useRef<LocalAudioTrack | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    
    const currentTrack = roomData?.playlist?.find((t: any) => t.id === roomData.currentTrackId);

    // This effect is the core of the Jukebox broadcaster.
    useEffect(() => {
        if (!localParticipant || !audioElRef.current) return;
        
        const audioElement = audioElRef.current;
        
        const setupAudioStream = async () => {
            if (audioTrackRef.current) {
                await localParticipant.unpublishTrack(audioTrackRef.current);
                audioTrackRef.current.stop();
                audioTrackRef.current = null;
            }

            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                 audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (mediaElementSourceRef.current?.context !== audioContextRef.current) {
                mediaElementSourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
            }
            
            const destination = audioContextRef.current.createMediaStreamDestination();
            mediaElementSourceRef.current.connect(destination);

            const [audioTrack] = destination.stream.getAudioTracks();
            
            if (audioTrack) {
                const newTrack = new LocalAudioTrack(audioTrack, { name: 'jukebox-audio' });
                audioTrackRef.current = newTrack;
                try {
                    await localParticipant.publishTrack(newTrack, { source: Track.Source.ScreenShareAudio });
                    console.log("Jukebox audio track published");
                } catch (e) {
                    console.error("Failed to publish jukebox audio track", e);
                    toast({ variant: 'destructive', title: "Jukebox Error", description: "Could not publish audio track." });
                }
            }
        };
        
        const handleCanPlay = () => {
            if (!audioContextRef.current || audioContextRef.current.state === 'suspended') {
                 audioContextRef.current?.resume().then(() => {
                     audioElement.play().catch(e => console.error("Audio playback failed", e));
                 });
            } else {
                 audioElement.play().catch(e => console.error("Audio playback failed", e));
            }
            setupAudioStream();
        };
        
        audioElement.addEventListener('canplay', handleCanPlay);

        return () => {
            audioElement.removeEventListener('canplay', handleCanPlay);
            if (audioTrackRef.current) {
                localParticipant.unpublishTrack(audioTrackRef.current).catch(console.error);
            }
        }

    }, [localParticipant, toast]);


    // Effect to control playback based on Firestore state
    useEffect(() => {
        const audio = audioElRef.current;
        if (!audio) return;

        if (roomData?.isPlaying && currentTrack?.streamUrl) {
            if (audio.src !== currentTrack.streamUrl) {
                audio.src = currentTrack.streamUrl;
                audio.load();
            }
            // `canplay` event listener will handle playing
        } else {
            audio.pause();
            if (audio.src) {
                audio.src = '';
            }
        }
    }, [roomData?.isPlaying, currentTrack]);


    return (
        <audio
            ref={audioElRef}
            crossOrigin="anonymous" // Important for capturing audio
            style={{ display: 'none' }}
        />
    );
}

export function JukeboxConnection({ roomData, roomRef }: JukeboxConnectionProps) {
    const { toast } = useToast();
    const [jukeboxToken, setJukeboxToken] = useState<string | undefined>(undefined);
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
                toast({ variant: 'destructive', title: "Jukebox Error", description: "Could not get connection token for Jukebox."})
            }
        }
        getJukeboxToken();
        return () => { isCancelled = true; }
    }, [roomId, toast]);

    if (!jukeboxToken || !livekitUrl) {
        return null; // Or a loading state
    }
    
    return (
        <LiveKitRoom
            serverUrl={livekitUrl}
            token={jukeboxToken}
            connect={true}
            audio={false} 
        >
            <JukeboxOrchestrator roomData={roomData} />
        </LiveKitRoom>
    )
}

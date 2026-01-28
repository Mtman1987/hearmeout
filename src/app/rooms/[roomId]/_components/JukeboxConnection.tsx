'use client';

import { useEffect, useState, useRef } from 'react';
import { LiveKitRoom, useLocalParticipant } from '@livekit/components-react';
import { LocalAudioTrack, Track } from 'livekit-client';
import { useToast } from '@/hooks/use-toast';
import { generateLiveKitToken } from '@/app/actions';

interface JukeboxConnectionProps {
    roomData: any;
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
        let isCleaningUp = false;

        const setupAudioStream = async () => {
            if (isCleaningUp || !localParticipant) return;
            
            // Clean up existing track before creating a new one
            if (audioTrackRef.current) {
                try {
                    await localParticipant.unpublishTrack(audioTrackRef.current);
                } catch (e) {
                    console.warn("Could not unpublish existing track, it may have already been unpublished.", e);
                }
                audioTrackRef.current.stop();
                audioTrackRef.current = null;
            }

            // Ensure AudioContext is running
             if (!audioContextRef.current) {
                 audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
             if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            // Create audio source from the <audio> element
            if (!mediaElementSourceRef.current || mediaElementSourceRef.current.context.state === 'closed') {
                mediaElementSourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
            }
            
            const destination = audioContextRef.current.createMediaStreamDestination();
            try {
                mediaElementSourceRef.current.disconnect();
            } catch(e) {/* Fails if not connected, which is fine */}
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
        
        const handleCanPlay = async () => {
            if (!audioContextRef.current || audioContextRef.current.state === 'suspended') {
                 await audioContextRef.current?.resume();
            }
            try {
                await audioElement.play();
                console.log("Audio playback started via canplay event.");
                // Only set up the stream if we can successfully play
                setupAudioStream();
            } catch(e) {
                console.error("Audio playback failed on canplay event:", e);
                toast({ variant: 'destructive', title: "Playback Error", description: "Could not start audio playback."})
            }
        };
        
        audioElement.addEventListener('canplay', handleCanPlay);
        audioElement.addEventListener('play', setupAudioStream); // Also try to set up on play

        return () => {
            isCleaningUp = true;
            audioElement.removeEventListener('canplay', handleCanPlay);
            audioElement.removeEventListener('play', setupAudioStream);
            if (audioTrackRef.current && localParticipant) {
                localParticipant.unpublishTrack(audioTrackRef.current).catch(console.error);
            }
            mediaElementSourceRef.current?.disconnect();
            audioContextRef.current?.close().catch(console.error);
            audioContextRef.current = null;
        }

    }, [localParticipant, toast]);


    // Effect to control playback based on Firestore state
    useEffect(() => {
        const audio = audioElRef.current;
        if (!audio) return;

        if (roomData?.isPlaying && currentTrack?.streamUrl) {
            if (audio.src !== currentTrack.streamUrl) {
                audio.src = currentTrack.streamUrl;
                audio.load(); // This will trigger the 'canplay' event
            } else {
                audio.play().catch(e => console.error("Failed to play audio:", e));
            }
        } else {
            audio.pause();
        }
    }, [roomData?.isPlaying, currentTrack]);


    return (
        <audio
            ref={audioElRef}
            crossOrigin="anonymous" // Important for capturing audio
            style={{ display: 'none' }}
            onEnded={() => console.log("Jukebox track ended.") /* Placeholder for future auto-next logic */}
        />
    );
}

export function JukeboxConnection({ roomData }: JukeboxConnectionProps) {
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
            video={false}
        >
            <JukeboxOrchestrator roomData={roomData} />
        </LiveKitRoom>
    )
}

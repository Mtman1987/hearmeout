
'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactPlayer from 'react-player/youtube';
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, deleteField } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants, useMediaDeviceSelect, useTracks } from '@livekit/components-react';
import '@livekit/components-styles';
import { useToast } from "@/hooks/use-toast";
import MusicJukeboxCard from "./MusicJukeboxCard";
import * as LivekitClient from 'livekit-client';

export interface RoomData {
  name: string;
  ownerId: string;
  djId?: string;
  djDisplayName?: string;
  playlist?: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
}

// This component contains the hidden ReactPlayer and handles publishing its audio stream.
// It only renders for the DJ. This version is robust and event-driven to avoid race conditions.
const JukeboxStreamer = ({ url, isPlaying, onEnded, onDuration, onProgress }: {
    url: string;
    isPlaying: boolean;
    onEnded: () => void;
    onDuration: (duration: number) => void;
    onProgress: (progress: number) => void;
}) => {
    const { localParticipant } = useLocalParticipant();
    const playerRef = useRef<ReactPlayer>(null);
    const trackPublicationRef = useRef<LivekitClient.LocalTrackPublication | null>(null);

    // This is the core logic. It's called when the player is ready to be used.
    const handlePlayerReady = useCallback(async () => {
        if (!localParticipant || !playerRef.current || trackPublicationRef.current) {
            return;
        }

        const internalPlayer = playerRef.current.getInternalPlayer();
        if (!internalPlayer || typeof (internalPlayer as any).captureStream !== 'function') {
            console.error("Failed to get internal player or captureStream function.");
            return;
        }

        try {
            // @ts-ignore - captureStream is a valid method on media elements
            const stream = internalPlayer.captureStream();
            const audioTrack = stream.getAudioTracks()[0];
            
            if (audioTrack) {
                console.log("Jukebox player ready. Publishing audio track...");
                const publication = await localParticipant.publishTrack(audioTrack, {
                    name: 'jukebox-audio',
                    source: LivekitClient.Track.Source.Unknown,
                });
                trackPublicationRef.current = publication;
                console.log("Jukebox audio track published successfully.");
            } else {
                 console.error("Could not find an audio track in the player stream.");
            }
        } catch (e) {
            console.error("Failed to publish jukebox track:", e);
        }
    }, [localParticipant]);

    // This effect handles cleanup. It unpublishes the track when the component is unmounted.
    useEffect(() => {
        // Return a cleanup function.
        return () => {
            if (localParticipant && trackPublicationRef.current) {
                console.log("JukeboxStreamer unmounting, unpublishing track.");
                localParticipant.unpublishTrack(trackPublicationRef.current.track);
                trackPublicationRef.current = null;
            }
        };
    }, [localParticipant]);

    return (
        <div className="hidden">
            <ReactPlayer
                ref={playerRef}
                url={url || ''}
                playing={isPlaying}
                onReady={handlePlayerReady}
                onEnded={onEnded}
                onDuration={onDuration}
                onProgress={(state) => onProgress(state.playedSeconds)}
                muted={true} // The DJ hears the audio through the regular jukebox card like everyone else
                width="1px"
                height="1px"
                config={{
                    youtube: { playerVars: { controls: 0, disablekb: 1 } },
                }}
            />
        </div>
    );
};


export default function UserList({ roomId }: { roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const allParticipants = [
    ...(localParticipant ? [localParticipant] : []),
    ...remoteParticipants,
  ];

  // Find the music track from any participant in the room
  const musicTrackRefs = useTracks([LivekitClient.Track.Source.Unknown]);
  const jukeboxTrackRef = musicTrackRefs.find(ref => ref.publication.trackName === 'jukebox-audio');

  // User microphone and speaker state
  const { 
    devices: micDevices, 
    activeDeviceId: activeMicId, 
    setActiveMediaDevice: setMicDevice 
  } = useMediaDeviceSelect({ kind: 'audioinput' });
  
  const { 
    devices: speakerDevices, 
    activeDeviceId: activeSpeakerId, 
    setActiveMediaDevice: setSpeakerDevice 
  } = useMediaDeviceSelect({ kind: 'audiooutput' });

  const [duration, setDuration] = useState(0);
  const [localProgress, setLocalProgress] = useState(0); // For DJ's remote control UI
  const [jukeboxRestartKey, setJukeboxRestartKey] = useState(0);

  // Firestore state
  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const isDj = user?.uid === room?.djId;
  const currentTrack = room?.playlist?.find(t => t.id === room?.currentTrackId);
  
  const handleMicDeviceChange = (deviceId: string) => {
      setMicDevice(deviceId);
      try {
          localStorage.setItem('hearmeout-user-mic-device-id', deviceId);
      } catch (e) {
          console.error("Failed to save mic device to localStorage", e);
      }
  };

  const handleSpeakerDeviceChange = (deviceId: string) => {
    setSpeakerDevice(deviceId);
    try {
      localStorage.setItem('hearmeout-user-speaker-device-id', deviceId);
    } catch (e) {
      console.error("Failed to save speaker device to localStorage", e);
    }
  }

  // Effect to load device preferences from local storage on mount
  useEffect(() => {
    try {
        const savedPanels = localStorage.getItem('hearmeout-active-panels');
        if (savedPanels) setActivePanels(JSON.parse(savedPanels));
    } catch (e) {
        console.error("Failed to load saved panel state from localStorage", e);
    }
  }, []);

  // Effect to set the initial speaker from local storage
  useEffect(() => {
      if (speakerDevices.length > 0) {
          const savedSpeakerId = localStorage.getItem('hearmeout-user-speaker-device-id');
          if (savedSpeakerId && speakerDevices.some(d => d.deviceId === savedSpeakerId)) {
              setSpeakerDevice(savedSpeakerId);
          }
      }
  }, [speakerDevices, setSpeakerDevice]);

  // Effect to set initial microphone from local storage
  useEffect(() => {
    if (micDevices.length > 0) {
        const savedUserMicId = localStorage.getItem('hearmeout-user-mic-device-id');
        if (savedUserMicId && micDevices.some(d => d.deviceId === savedUserMicId)) {
            setMicDevice(savedUserMicId);
        }
    }
  }, [micDevices, setMicDevice]);


  useEffect(() => {
    if (localParticipant && activeMicId) {
      const audioOptions: LivekitClient.AudioCaptureOptions = { deviceId: activeMicId };
      localParticipant.setMicrophoneEnabled(true, audioOptions);
    }
  }, [localParticipant, activeMicId]);

  const handlePlaySong = (songId: string) => {
    if (!isDj || !roomRef) return;
    setLocalProgress(0); // Reset progress when changing songs
    updateDocumentNonBlocking(roomRef, {
        currentTrackId: songId,
        isPlaying: true,
    });
  }

  const handlePlayPause = (playing: boolean) => {
    if (!isDj || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { isPlaying: playing });
  }

  const handlePlayNext = () => {
    if (!isDj || !roomRef || !room?.playlist || !room.currentTrackId) return;
    const currentIndex = room.playlist.findIndex(t => t.id === room.currentTrackId);
    if (currentIndex === -1) { 
        if (room.playlist.length > 0) handlePlaySong(room.playlist[0].id);
        return;
    }
    const nextIndex = (currentIndex + 1) % room.playlist.length;
    handlePlaySong(room.playlist[nextIndex].id);
  };

  const handlePlayPrev = () => {
     if (!isDj || !roomRef || !room?.playlist || !room.currentTrackId) return;
    const currentIndex = room.playlist.findIndex(t => t.id === room.currentTrackId);
    const prevIndex = (currentIndex - 1 + room.playlist.length) % room.playlist.length;
    handlePlaySong(room.playlist[prevIndex].id);
  };

  const handleAddItems = (newItems: PlaylistItem[]) => {
    if (!user || !roomRef || !room) return;
    const newPlaylist = [...(room.playlist || []), ...newItems];
    updateDocumentNonBlocking(roomRef, { playlist: newPlaylist });

    if (isDj && !room.isPlaying && (!room.playlist || room.playlist.length === 0)) {
       handlePlaySong(newItems[0].id);
    }
  };

  const handleTogglePanel = (panel: 'playlist' | 'add') => {
    setActivePanels(prev => {
        const newPanels = { ...prev, [panel]: !prev[panel] };
        try {
            localStorage.setItem('hearmeout-active-panels', JSON.stringify(newPanels));
        } catch (e) {
            console.error("Failed to save panel state to localStorage", e);
        }
        return newPanels;
    });
  }

  const handleRemoveSong = (songId: string) => {
    if (!isDj || !roomRef || !room?.playlist) return;
    const newPlaylist = room.playlist.filter(song => song.id !== songId);

    let updates: Partial<RoomData> & { currentTrackId?: any } = { playlist: newPlaylist };
    
    if (room.currentTrackId === songId) {
      if (newPlaylist.length > 0) {
        const deletedIndex = room.playlist.findIndex(t => t.id === songId);
        const nextIndex = deletedIndex >= newPlaylist.length ? 0 : deletedIndex;
        updates.currentTrackId = newPlaylist[nextIndex]?.id;
      } else {
        updates.currentTrackId = deleteField();
        updates.isPlaying = false;
      }
    }
    
    updateDocumentNonBlocking(roomRef, updates);
  };

  const handleClearPlaylist = () => {
    if (!isDj || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { 
      playlist: [],
      currentTrackId: deleteField(),
      isPlaying: false,
    });
  };

  // Manual seek from the DJ's remote control.
  const handleSeek = (seconds: number) => {
      if(isDj) {
        setLocalProgress(seconds);
      }
  };
  
  const handleForceJukeboxRestart = () => {
    if (isDj) {
        console.log("Forcing jukebox restart...");
        setJukeboxRestartKey(prev => prev + 1);
        toast({ title: "Jukebox Restarted", description: "The audio stream has been force-restarted." });
    }
  };

  return (
    <>
      {isDj && (
        <JukeboxStreamer 
            key={jukeboxRestartKey} // This key is critical for the restart mechanism
            url={currentTrack?.url || ''}
            isPlaying={room?.isPlaying || false}
            onEnded={handlePlayNext}
            onDuration={setDuration}
            onProgress={setLocalProgress}
        />
      )}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {isDj && (
              <div className="lg:col-span-1 h-full">
                <MusicPlayerCard
                  currentTrack={currentTrack}
                  progress={localProgress}
                  duration={duration}
                  playing={room?.isPlaying || false}
                  isPlayerControlAllowed={isDj}
                  onPlayPause={handlePlayPause}
                  onPlayNext={handlePlayNext}
                  onPlayPrev={handlePlayPrev}
                  onSeek={handleSeek}
                  activePanels={activePanels}
                  onTogglePanel={handleTogglePanel}
                  onForceJukeboxRestart={handleForceJukeboxRestart}
                />
              </div>
            )}
            
            <div className={isDj ? "lg:col-span-2" : "lg:col-span-3"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {((isDj || activePanels.playlist) && (jukeboxTrackRef || isDj)) && (
                        <div className={(isDj || activePanels.add) ? "md:col-span-1" : "md:col-span-2"}>
                            <PlaylistPanel
                                playlist={room?.playlist || []}
                                onPlaySong={handlePlaySong}
                                currentTrackId={room?.currentTrackId || ""}
                                isPlayerControlAllowed={isDj}
                                onRemoveSong={handleRemoveSong}
                                onClearPlaylist={handleClearPlaylist}
                            />
                        </div>
                    )}

                    {((isDj || activePanels.add) && (jukeboxTrackRef || isDj)) && (
                        <div className={(isDj || activePanels.playlist) ? "md:col-span-1" : "md:col-span-2"}>
                            <AddMusicPanel
                                onAddItems={handleAddItems}
                                onClose={() => handleTogglePanel('add')}
                                canAddMusic={!!user}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <MusicJukeboxCard 
            key="jukebox-permanent"
            trackRef={jukeboxTrackRef}
            activePanels={activePanels}
            onTogglePanel={handleTogglePanel}
            onPlayNext={isDj ? handlePlayNext : () => {}}
          />

          {allParticipants.map((participant) => {
              const isLocal = participant.sid === localParticipant?.sid;
              return (
                <UserCard
                  key={participant.sid}
                  participant={participant}
                  isLocal={isLocal}
                  isHost={participant.identity === room?.ownerId}
                  roomId={roomId}
                  micDevices={isLocal ? micDevices : undefined}
                  speakerDevices={isLocal ? speakerDevices : undefined}
                  activeMicId={isLocal ? activeMicId : ''}
                  activeSpeakerId={isLocal ? activeSpeakerId : ''}
                  onMicDeviceChange={isLocal ? handleMicDeviceChange : undefined}
                  onSpeakerDeviceChange={isLocal ? handleSpeakerDeviceChange : undefined}
                />
              )
            })
          }
        </div>
      </div>
    </>
  );
}

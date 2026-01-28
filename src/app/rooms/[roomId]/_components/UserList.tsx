'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import React, { useState, useEffect, useRef, useCallback } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, deleteField } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants, useMediaDeviceSelect, useTracks } from '@livekit/components-react';
import '@livekit/components-styles';
import { useToast } from "@/hooks/use-toast";
import * as LivekitClient from 'livekit-client';
import MusicJukeboxCard from "./MusicJukeboxCard";
import JukeboxConnector from "./JukeboxConnector";


export interface RoomData {
  name: string;
  ownerId: string;
  djId?: string;
  djDisplayName?: string;
  playlist?: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
}

export default function UserList({ roomId }: { roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // LiveKit Hooks
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  
  const jukeboxParticipant = remoteParticipants.find(p => p.identity === 'jukebox');
  const humanParticipants = [
    ...(localParticipant ? [localParticipant] : []),
    ...remoteParticipants.filter(p => p.identity !== 'jukebox'),
  ];
  
  const jukeboxTracks = useTracks([LivekitClient.Track.Source.Unknown], { participant: jukeboxParticipant });
  const jukeboxAudioTrack = jukeboxTracks.find(t => t.publication.kind === 'audio');


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


  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const isDj = user?.uid === room?.djId;
  const currentTrack = room?.playlist?.find(t => t.id === room?.currentTrackId);
  
  const handlePlayNext = useCallback(() => {
    if (!isDj || !roomRef || !room?.playlist || room.playlist.length === 0) return;
    const currentTrackId = room.currentTrackId;
    const currentIndex = currentTrackId ? room.playlist.findIndex(t => t.id === currentTrackId) : -1;
    
    if (currentIndex === -1) { 
        handlePlaySong(room.playlist[0].id);
        return;
    }
    const nextIndex = (currentIndex + 1) % room.playlist.length;
    handlePlaySong(room.playlist[nextIndex].id);
  }, [isDj, roomRef, room?.playlist, room?.currentTrackId]);

  // Effect to manage the playback timer ONLY on the DJ's client
  useEffect(() => {
    if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
    }

    if (isDj && room?.isPlaying && currentTrack) {
        progressIntervalRef.current = setInterval(() => {
            setPlaybackProgress(prev => {
                if (currentTrack.duration && prev >= currentTrack.duration) {
                    clearInterval(progressIntervalRef.current!);
                    progressIntervalRef.current = null;
                    // Automatically play next song when one finishes
                    handlePlayNext();
                    return 0;
                }
                return prev + 1;
            });
        }, 1000);
    }

    return () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
    };
  }, [room?.isPlaying, currentTrack, isDj, handlePlayNext]);

  // Effect to reset progress when the track changes
  useEffect(() => {
      setPlaybackProgress(0);
  }, [currentTrack?.id]);


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

  useEffect(() => {
      if (speakerDevices.length > 0) {
          const savedSpeakerId = localStorage.getItem('hearmeout-user-speaker-device-id');
          if (savedSpeakerId && speakerDevices.some(d => d.deviceId === savedSpeakerId)) {
              setSpeakerDevice(savedSpeakerId);
          }
      }
  }, [speakerDevices, setSpeakerDevice]);

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
    updateDocumentNonBlocking(roomRef, {
        currentTrackId: songId,
        isPlaying: true,
    });
  }

  const handlePlayPause = (playing: boolean) => {
    if (!isDj || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { isPlaying: playing });
  }

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

  return (
    <>
      {isDj && <JukeboxConnector roomId={roomId} />}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {isDj && (
              <div className="lg:col-span-1 h-full">
                <MusicPlayerCard
                  currentTrack={currentTrack}
                  progress={playbackProgress}
                  duration={currentTrack?.duration || 0}
                  playing={room?.isPlaying || false}
                  isPlayerControlAllowed={isDj}
                  onPlayPause={handlePlayPause}
                  onPlayNext={handlePlayNext}
                  onPlayPrev={handlePlayPrev}
                  onSeek={() => {}}
                  activePanels={activePanels}
                  onTogglePanel={handleTogglePanel}
                />
              </div>
            )}
            
            <div className={isDj ? "lg:col-span-2" : "lg:col-span-3"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(activePanels.playlist) && (
                        <div className={activePanels.add ? "md:col-span-1" : "md:col-span-2"}>
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

                    {(activePanels.add) && (
                        <div className={activePanels.playlist ? "md:col-span-1" : "md:col-span-2"}>
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
          {jukeboxParticipant && (
            <MusicJukeboxCard 
              trackRef={jukeboxAudioTrack}
              activePanels={activePanels}
              onTogglePanel={handleTogglePanel}
              onPlayNext={handlePlayNext}
            />
          )}
          {humanParticipants.map((participant) => {
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

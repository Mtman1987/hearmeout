'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import React, { useState, useEffect, useRef } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, deleteField } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants, useMediaDeviceSelect } from '@livekit/components-react';
import * as LivekitClient from 'livekit-client';
import '@livekit/components-styles';
import { useToast } from "@/hooks/use-toast";
import MusicJukeboxCard from "./MusicJukeboxCard";

const initialPlaylist: PlaylistItem[] = [
  { id: "1", title: "Golden Hour", artist: "JVKE", artId: "album-art-1", url: "https://www.youtube.com/watch?v=c9scA_s1d4A" },
  { id: "2", title: "Sofia", artist: "Clairo", artId: "album-art-2", url: "https://www.youtube.com/watch?v=L9l8zCOwEII" },
  { id: "3", title: "Sweden", artist: "C418", artId: "album-art-3", url: "https://www.youtube.com/watch?v=aBkTkxapoJY" },
];

export interface RoomData {
  name: string;
  ownerId: string;
  djId?: string;
  djDisplayName?: string;
  playlist?: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
  currentTrackProgress?: number;
}

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

  // Firestore state
  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const isDj = user?.uid === room?.djId;
  
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


  // Effect to publish/unpublish the microphone track
  useEffect(() => {
    // This effect manages the microphone track based on the activeMicId
    if (!localParticipant || !activeMicId) {
      return;
    }
    
    // Options for the track
    const audioOptions: LivekitClient.AudioCaptureOptions = { deviceId: activeMicId };

    // The `setMicrophoneEnabled` function with `audioOptions` handles everything:
    // - It creates and publishes a track if not already present.
    // - It replaces the track if the deviceId changes.
    // We just need to make sure to disable it on cleanup.
    localParticipant.setMicrophoneEnabled(true, audioOptions);

    return () => {
      // On cleanup, disable the microphone. This will unpublish the track.
      // This is crucial for React 18 Strict Mode's double-useEffect behavior.
      localParticipant.setMicrophoneEnabled(false);
    };
  }, [localParticipant, activeMicId]);

  useEffect(() => {
    if (room && !room.playlist && isDj && roomRef) {
        updateDocumentNonBlocking(roomRef, { 
            playlist: initialPlaylist,
            currentTrackId: initialPlaylist[0].id,
            isPlaying: false,
            currentTrackProgress: 0,
        });
    }
  }, [room, isDj, roomRef]);


  const handlePlaySong = (songId: string) => {
    if (!isDj || !roomRef) return;
    updateDocumentNonBlocking(roomRef, {
        currentTrackId: songId,
        isPlaying: true,
        currentTrackProgress: 0,
    });
  }

  const handlePlayPause = (playing: boolean) => {
    if (!isDj || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { isPlaying: playing });
  }

  const handlePlayNext = () => {
    if (!isDj || !roomRef || !room?.playlist || !room.currentTrackId) return;
    const currentIndex = room.playlist.findIndex(t => t.id === room.currentTrackId);
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

    let updates: Partial<RoomData> & { currentTrackId?: any, currentTrackProgress?: any } = { playlist: newPlaylist };
    
    if (room.currentTrackId === songId) {
      if (newPlaylist.length > 0) {
        const deletedIndex = room.playlist.findIndex(t => t.id === songId);
        const nextIndex = deletedIndex >= newPlaylist.length ? 0 : deletedIndex;
        updates.currentTrackId = newPlaylist[nextIndex]?.id;
        updates.currentTrackProgress = 0;
      } else {
        updates.currentTrackId = deleteField();
        updates.isPlaying = false;
        updates.currentTrackProgress = deleteField();
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
      currentTrackProgress: deleteField(),
    });
  };

  const handleSeek = (seconds: number) => {
      if (isDj && roomRef) {
          updateDocumentNonBlocking(roomRef, { currentTrackProgress: seconds });
      }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {isDj && (
              <div className="lg:col-span-1 h-full">
                <MusicPlayerCard
                  currentTrack={room?.playlist?.find(t => t.id === room?.currentTrackId)}
                  progress={room?.currentTrackProgress || 0}
                  duration={duration}
                  playing={room?.isPlaying || false}
                  isPlayerControlAllowed={isDj}
                  onPlayPause={handlePlayPause}
                  onPlayNext={handlePlayNext}
                  onPlayPrev={handlePlayPrev}
                  onSeek={handleSeek}
                  activePanels={activePanels}
                  onTogglePanel={handleTogglePanel}
                />
              </div>
            )}
            
            <div className={isDj ? "lg:col-span-2" : "lg:col-span-3"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activePanels.playlist && (
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

                    {activePanels.add && (
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
          {room?.currentTrackId && (
            <MusicJukeboxCard 
              room={room} 
              isHost={isDj}
              roomRef={roomRef}
              setDuration={setDuration}
              activePanels={activePanels}
              onTogglePanel={handleTogglePanel}
            />
          )}

          {allParticipants.map((participant) => {
              const amITheLocalParticipant = participant.sid === localParticipant?.sid;
              return (
                <UserCard
                  key={participant.sid}
                  participant={participant}
                  isLocal={amITheLocalParticipant}
                  isHost={participant.identity === room?.ownerId}
                  roomId={roomId}
                  micDevices={amITheLocalParticipant ? micDevices : undefined}
                  speakerDevices={amITheLocalParticipant ? speakerDevices : undefined}
                  activeMicId={amITheLocalParticipant ? activeMicId : ''}
                  activeSpeakerId={amITheLocalParticipant ? activeSpeakerId : ''}
                  onMicDeviceChange={amITheLocalParticipant ? handleMicDeviceChange : undefined}
                  onSpeakerDeviceChange={amITheLocalParticipant ? handleSpeakerDeviceChange : undefined}
                />
              )
            })
          }
        </div>
      </div>
    </>
  );
}

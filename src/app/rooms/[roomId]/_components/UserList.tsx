'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState, useEffect, useRef } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, deleteField } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';
import { createLocalAudioTrack, LocalTrackPublication, Room, Track, type MediaDevice } from 'livekit-client';
import ReactPlayer from 'react-player/youtube';
import '@livekit/components-styles';
import { useToast } from "@/hooks/use-toast";

const initialPlaylist: PlaylistItem[] = [
  { id: "1", title: "Golden Hour", artist: "JVKE", artId: "album-art-1", url: "https://www.youtube.com/watch?v=c9scA_s1d4A" },
  { id: "2", title: "Sofia", artist: "Clairo", artId: "album-art-2", url: "https://www.youtube.com/watch?v=L9l8zCOwEII" },
  { id: "3", title: "Sweden", artist: "C418", artId: "album-art-3", url: "https://www.youtube.com/watch?v=aBkTkxapoJY" },
];

interface RoomData {
  name: string;
  ownerId: string;
  playlist?: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
  currentTrackProgress?: number;
}

export default function UserList({ musicPlayerOpen, roomId }: { musicPlayerOpen: boolean, roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const actualParticipants = remoteParticipants.filter(p => p.identity !== 'Jukebox');

  // User microphone and speaker state
  const [micDeviceId, setMicDeviceId] = useState<string | undefined>();
  const micTrackPublicationRef = useRef<LocalTrackPublication | null>(null);
  const [speakerDeviceId, setSpeakerDeviceId] = useState<string | undefined>();
  
  // All available devices
  const [allAudioInputDevices, setAllAudioInputDevices] = useState<MediaDevice[]>([]);
  const [allAudioOutputDevices, setAllAudioOutputDevices] = useState<MediaDevice[]>([]);


  // Player and Progress state
  const playerRef = useRef<ReactPlayer>(null);
  const progressUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Firestore state
  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const isRoomOwner = !!user && !!room && user.uid === room.ownerId;
  const canControlMusic = isRoomOwner;

  // Handler for changing user's primary microphone
  const handleMicDeviceChange = (deviceId: string) => {
      setMicDeviceId(deviceId);
      try {
          localStorage.setItem('hearmeout-user-mic-device-id', deviceId);
      } catch (e) {
          console.error("Failed to save mic device to localStorage", e);
      }
  };

  const handleSpeakerDeviceChange = (deviceId: string) => {
    setSpeakerDeviceId(deviceId);
    Room.setActiveDevice('audiooutput', deviceId);
    try {
      localStorage.setItem('hearmeout-user-speaker-device-id', deviceId);
    } catch (e) {
      console.error("Failed to save speaker device to localStorage", e);
    }
  }

  // Effect to load ALL saved settings from local storage on mount
  useEffect(() => {
    if (!localParticipant) return;

    const getDevices = async () => {
        try {
            const [inputs, outputs] = await Promise.all([
                Room.getLocalDevices('audioinput'),
                Room.getLocalDevices('audiooutput'),
            ]);
            setAllAudioInputDevices(inputs);
            setAllAudioOutputDevices(outputs);

            const savedUserMicId = localStorage.getItem('hearmeout-user-mic-device-id');

            if (savedUserMicId && inputs.some(d => d.deviceId === savedUserMicId)) {
                setMicDeviceId(savedUserMicId);
            } else if (inputs.length > 0) {
                setMicDeviceId(inputs[0].deviceId);
            }

            const savedSpeakerId = localStorage.getItem('hearmeout-user-speaker-device-id');
            if (savedSpeakerId && outputs.some(d => d.deviceId === savedSpeakerId)) {
              setSpeakerDeviceId(savedSpeakerId);
              Room.setActiveDevice('audiooutput', savedSpeakerId);
            } else if (outputs.length > 0) {
              setSpeakerDeviceId(outputs[0].deviceId);
            }

        } catch (e) {
            console.error("Failed to get local devices", e);
            toast({ variant: 'destructive', title: "Device Error", description: "Could not access audio devices. Please check browser permissions." });
        }
    };
    
    getDevices();
    
    try {
        const savedPanels = localStorage.getItem('hearmeout-active-panels');
        if (savedPanels) setActivePanels(JSON.parse(savedPanels));
    } catch (e) {
        console.error("Failed to load saved panel state from localStorage", e);
    }
  }, [localParticipant, toast]); 

  // Effect to publish/unpublish the microphone track
  useEffect(() => {
    const setupMicTrack = async () => {
      if (!localParticipant || !micDeviceId) return;

      if (micTrackPublicationRef.current) {
        if(micTrackPublicationRef.current.track?.mediaStreamTrack.getSettings().deviceId !== micDeviceId) {
          await localParticipant.unpublishTrack(micTrackPublicationRef.current.track, true);
          micTrackPublicationRef.current = null;
        } else {
          return; 
        }
      }

      try {
        const track = await createLocalAudioTrack({ deviceId: micDeviceId });
        const publication = await localParticipant.publishTrack(track, {
          source: Track.Source.Microphone,
        });
        micTrackPublicationRef.current = publication;
      } catch (e) {
        console.error("Failed to create and publish mic track:", e);
        toast({ variant: "destructive", title: "Microphone Error", description: "Could not use the selected microphone." });
      }
    };
    setupMicTrack();
  }, [localParticipant, micDeviceId, toast]);


  // Effect for Host to update progress
  useEffect(() => {
    if (isRoomOwner && room?.isPlaying && roomRef) {
      progressUpdateIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          const progress = playerRef.current.getCurrentTime();
          if (progress > 0) {
            updateDocumentNonBlocking(roomRef, { currentTrackProgress: progress });
          }
        }
      }, 2000);
    } else {
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
      }
    }

    return () => {
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
      }
    };
  }, [isRoomOwner, room?.isPlaying, roomRef]);

  // Effect for listeners to sync progress
  useEffect(() => {
    if (playerRef.current && !isRoomOwner && room?.currentTrackProgress) {
        const localProgress = playerRef.current.getCurrentTime();
        // Sync if more than 3 seconds out of sync
        if (Math.abs(localProgress - room.currentTrackProgress) > 3) { 
            playerRef.current.seekTo(room.currentTrackProgress, 'seconds');
        }
    }
  }, [room?.currentTrackProgress, isRoomOwner]);


  useEffect(() => {
    if (room && !room.playlist && isRoomOwner && roomRef) {
        updateDocumentNonBlocking(roomRef, { 
            playlist: initialPlaylist,
            currentTrackId: initialPlaylist[0].id,
            isPlaying: false,
            currentTrackProgress: 0,
        });
    }
  }, [room, isRoomOwner, roomRef]);


  const handlePlaySong = (songId: string) => {
    if (!canControlMusic || !roomRef) return;
    updateDocumentNonBlocking(roomRef, {
        currentTrackId: songId,
        isPlaying: true,
        currentTrackProgress: 0,
    });
  }

  const handlePlayPause = (playing: boolean) => {
    if (!canControlMusic || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { isPlaying: playing });
  }

  const handlePlayNext = () => {
    if (!canControlMusic || !roomRef || !room?.playlist || !room.currentTrackId) return;
    const currentIndex = room.playlist.findIndex(t => t.id === room.currentTrackId);
    const nextIndex = (currentIndex + 1) % room.playlist.length;
    handlePlaySong(room.playlist[nextIndex].id);
  };

  const handlePlayPrev = () => {
     if (!canControlMusic || !roomRef || !room?.playlist || !room.currentTrackId) return;
    const currentIndex = room.playlist.findIndex(t => t.id === room.currentTrackId);
    const prevIndex = (currentIndex - 1 + room.playlist.length) % room.playlist.length;
    handlePlaySong(room.playlist[prevIndex].id);
  };

  const handleAddItems = (newItems: PlaylistItem[]) => {
    if (!isRoomOwner || !roomRef || !room) return;
    const newPlaylist = [...(room.playlist || []), ...newItems];
    updateDocumentNonBlocking(roomRef, { playlist: newPlaylist });

    if (!room.isPlaying && (!room.playlist || room.playlist.length === 0)) {
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
    if (!isRoomOwner || !roomRef || !room?.playlist) return;
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
    if (!isRoomOwner || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { 
      playlist: [],
      currentTrackId: deleteField(),
      isPlaying: false,
      currentTrackProgress: deleteField(),
    });
  };

  const handleSeek = (seconds: number) => {
    if (playerRef.current) {
        playerRef.current.seekTo(seconds, 'seconds');
        if (canControlMusic && roomRef) {
            updateDocumentNonBlocking(roomRef, { currentTrackProgress: seconds });
        }
    }
  };

  const currentTrack = room?.playlist?.find(t => t.id === room?.currentTrackId);
  const playerProgressInSeconds = room?.currentTrackProgress || 0;

  return (
    <>
      <div className="flex flex-col gap-6">
        {musicPlayerOpen && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1 h-full">
               <MusicPlayerCard
                ref={playerRef}
                roomId={roomId}
                currentTrack={currentTrack}
                playlist={room?.playlist || []}
                playing={room?.isPlaying || false}
                progress={playerProgressInSeconds}
                onSeek={handleSeek}
                isPlayerControlAllowed={canControlMusic}
                onPlayPause={handlePlayPause}
                onPlayNext={handlePlayNext}
                onPlayPrev={handlePlayPrev}
                activePanels={activePanels}
                onTogglePanel={handleTogglePanel}
                isRoomOwner={isRoomOwner}
              />
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {activePanels.playlist && (
                  <div className={activePanels.add ? "md:col-span-1" : "md:col-span-2"}>
                      <PlaylistPanel
                          playlist={room?.playlist || []}
                          onPlaySong={handlePlaySong}
                          currentTrackId={room?.currentTrackId || ""}
                          isPlayerControlAllowed={canControlMusic}
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
                          canAddMusic={isRoomOwner}
                      />
                  </div>
              )}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {localParticipant && (
            <UserCard
              key={localParticipant.sid}
              participant={localParticipant}
              isHost={isRoomOwner}
              roomId={roomId}
              micDevices={allAudioInputDevices}
              speakerDevices={allAudioOutputDevices}
              activeMicId={micDeviceId || ''}
              activeSpeakerId={speakerDeviceId || ''}
              onMicDeviceChange={handleMicDeviceChange}
              onSpeakerDeviceChange={handleSpeakerDeviceChange}
            />
          )}

          {actualParticipants.map((participant) => (
            <UserCard
              key={participant.sid}
              participant={participant}
              isHost={false}
              roomId={roomId}
            />
          ))}
        </div>
      </div>
    </>
  );
}

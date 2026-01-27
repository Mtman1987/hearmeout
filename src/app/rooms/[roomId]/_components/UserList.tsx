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

export default function UserList({ roomId, isDj }: { roomId: string, isDj: boolean }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  // User microphone and speaker state
  const [micDeviceId, setMicDeviceId] = useState<string | undefined>();
  const micTrackPublicationRef = useRef<LocalTrackPublication | null>(null);
  const [speakerDeviceId, setSpeakerDeviceId] = useState<string | undefined>();
  
  // All available devices
  const [allAudioInputDevices, setAllAudioInputDevices] = useState<MediaDevice[]>([]);
  const [allAudioOutputDevices, setAllAudioOutputDevices] = useState<MediaDevice[]>([]);

  const [duration, setDuration] = useState(0);

  // Firestore state
  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const canControlMusic = isDj;

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

  useEffect(() => {
    if (room && !room.playlist && canControlMusic && roomRef) {
        updateDocumentNonBlocking(roomRef, { 
            playlist: initialPlaylist,
            currentTrackId: initialPlaylist[0].id,
            isPlaying: false,
            currentTrackProgress: 0,
        });
    }
  }, [room, canControlMusic, roomRef]);


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
    if (!user || !roomRef || !room) return;
    const newPlaylist = [...(room.playlist || []), ...newItems];
    updateDocumentNonBlocking(roomRef, { playlist: newPlaylist });

    if (canControlMusic && !room.isPlaying && (!room.playlist || room.playlist.length === 0)) {
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
    if (!canControlMusic || !roomRef || !room?.playlist) return;
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
    if (!canControlMusic || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { 
      playlist: [],
      currentTrackId: deleteField(),
      isPlaying: false,
      currentTrackProgress: deleteField(),
    });
  };

  const handleSeek = (seconds: number) => {
      if (canControlMusic && roomRef) {
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
                  isPlayerControlAllowed={canControlMusic}
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
              isHost={canControlMusic}
              roomRef={roomRef}
              setDuration={setDuration}
              activePanels={activePanels}
              onTogglePanel={handleTogglePanel}
            />
          )}

          {localParticipant && (
            <UserCard
              key={localParticipant.sid}
              participant={localParticipant}
              isHost={user?.uid === room?.ownerId}
              roomId={roomId}
              micDevices={allAudioInputDevices}
              speakerDevices={allAudioOutputDevices}
              activeMicId={micDeviceId || ''}
              activeSpeakerId={speakerDeviceId || ''}
              onMicDeviceChange={handleMicDeviceChange}
              onSpeakerDeviceChange={handleSpeakerDeviceChange}
            />
          )}

          {remoteParticipants.map((participant) => (
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

'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState, useEffect, useRef } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, deleteField } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants, useMediaDeviceSelect, useTracks, AudioTrack } from '@livekit/components-react';
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

/**
 * An invisible component that finds the 'Jukebox' participant and renders its audio track,
 * allowing everyone in the room to hear the music stream.
 */
const JukeboxAudioHandler = () => {
  const remoteParticipants = useRemoteParticipants();
  const jukeboxParticipant = remoteParticipants.find(p => p.identity === 'Jukebox');
  
  // Attempt to subscribe to any audio track from the jukebox participant.
  const tracks = useTracks(
      [Track.Source.Microphone, Track.Source.Unknown], 
      { participant: jukeboxParticipant }
  );

  if (!jukeboxParticipant) {
    return null;
  }

  // Find the first audio track and render it. LiveKit's <AudioTrack> component
  // handles creating the <audio> element and playing the stream.
  const audioTrackRef = tracks.find(trackRef => trackRef.publication.kind === 'audio');

  return audioTrackRef ? <AudioTrack trackRef={audioTrackRef} /> : null;
};


const RoomParticipants = ({ 
    isHost, 
    roomId,
    micDevices,
    activeMicId,
    onMicDeviceChange,
}: { 
    isHost: boolean; 
    roomId: string;
    micDevices: MediaDevice[];
    activeMicId: string;
    onMicDeviceChange: (deviceId: string) => void;
}) => {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  // Filter out the Jukebox participant so it doesn't get a UI card
  const humanParticipants = remoteParticipants.filter(p => p.identity !== 'Jukebox');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
       {localParticipant && (
        <UserCard
          key={localParticipant.sid}
          participant={localParticipant}
          isHost={isHost}
          roomId={roomId}
          micDevices={micDevices}
          activeMicId={activeMicId}
          onMicDeviceChange={onMicDeviceChange}
        />
      )}
      {humanParticipants.map((participant) => (
        <UserCard 
          key={participant.sid}
          participant={participant}
          isHost={false}
          roomId={roomId}
        />
      ))}
    </div>
  );
};

export default function UserList({ musicPlayerOpen, roomId }: { musicPlayerOpen: boolean, roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  
  // --- All Local Participant Media Logic is Centralized Here ---
  const { localParticipant } = useLocalParticipant();
  
  // Jukebox state
  const { devices: audioDevices } = useMediaDeviceSelect({ kind: 'audioinput' });
  const [musicDeviceId, setMusicDeviceId] = useState<string | undefined>();
  const musicTrackPublicationRef = useRef<LocalTrackPublication | null>(null);

  // User microphone state
  const { 
      devices: micDevices, 
      activeDeviceId: activeMicId, 
      setMediaDevice: setMicDevice 
  } = useMediaDeviceSelect({ kind: 'audioinput' });

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
  const handleMicDeviceChange = async (deviceId: string) => {
      try {
          await setMicDevice(deviceId);
          localStorage.setItem('hearmeout-user-mic-device-id', deviceId);
      } catch (e) {
          console.error("Failed to set media device:", e);
          toast({
              variant: "destructive",
              title: "Error switching microphone",
              description: "Could not switch to the selected microphone."
          });
      }
  };

  // Effect to load ALL saved settings from local storage on mount
  useEffect(() => {
    try {
        const savedJukeboxDeviceId = localStorage.getItem('hearmeout-jukebox-device-id');
        if (savedJukeboxDeviceId) setMusicDeviceId(savedJukeboxDeviceId);

        const savedUserMicId = localStorage.getItem('hearmeout-user-mic-device-id');
        if (savedUserMicId) setMicDevice(savedUserMicId);
        
        const savedPanels = localStorage.getItem('hearmeout-active-panels');
        if (savedPanels) setActivePanels(JSON.parse(savedPanels));

    } catch (e) {
        console.error("Failed to load saved state from localStorage", e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to publish/unpublish the jukebox track
  useEffect(() => {
    const setupJukeboxTrack = async () => {
      if (!isRoomOwner || !localParticipant || !musicDeviceId) {
        if (musicTrackPublicationRef.current) {
          try {
            await localParticipant.unpublishTrack(musicTrackPublicationRef.current.track, true);
          } catch (e) {
            console.error("Failed to unpublish jukebox track:", e);
          }
          musicTrackPublicationRef.current = null;
        }
        return;
      }

      if (musicTrackPublicationRef.current) {
         if (musicTrackPublicationRef.current.track?.mediaStreamTrack.getSettings().deviceId === musicDeviceId) {
            return; // Already using the correct track
        }
        await localParticipant.unpublishTrack(musicTrackPublicationRef.current.track, true);
      }
      
      try {
        const track = await createLocalAudioTrack({ deviceId: musicDeviceId });
        const publication = await localParticipant.publishTrack(track, {
          name: 'Jukebox',
          source: 'jukebox', // Custom source to identify the track
        });
        musicTrackPublicationRef.current = publication;
      } catch (e) {
        console.error("Failed to create and publish jukebox track:", e);
      }
    };

    setupJukeboxTrack();

    return () => {
      if (musicTrackPublicationRef.current && localParticipant) {
        localParticipant.unpublishTrack(musicTrackPublicationRef.current.track, true)
          .catch(e => console.error("Failed to unpublish jukebox track on unmount:", e));
      }
    };
  }, [isRoomOwner, localParticipant, musicDeviceId]);

  // Effect to seek the player for non-hosts
  useEffect(() => {
    if (playerRef.current && !isRoomOwner && room?.currentTrackProgress) {
        const localProgress = playerRef.current.getCurrentTime();
        // Only seek if the difference is significant to avoid jitter
        if (Math.abs(localProgress - room.currentTrackProgress) > 2) { 
            playerRef.current.seekTo(room.currentTrackProgress, 'seconds');
        }
    }
  }, [room?.currentTrackProgress, isRoomOwner]);

  // Effect to handle progress updates from the host
  useEffect(() => {
    if (isRoomOwner && room?.isPlaying && roomRef) {
      // Start interval to update progress
      progressUpdateIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          const progress = playerRef.current.getCurrentTime(); // progress is in seconds
          if (progress > 0) {
            updateDocumentNonBlocking(roomRef, { currentTrackProgress: progress });
          }
        }
      }, 2000); // Update every 2 seconds
    } else {
      // Clear interval if not playing or not owner
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


  useEffect(() => {
    if (room && !room.playlist && isRoomOwner) {
        updateDocumentNonBlocking(roomRef!, { 
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

  const handleMusicDeviceSelect = (deviceId: string) => {
    setMusicDeviceId(deviceId);
    try {
        localStorage.setItem('hearmeout-jukebox-device-id', deviceId);
    } catch (e) {
        console.error("Failed to save Jukebox device to localStorage", e);
    }
  };

  const currentTrack = room?.playlist?.find(t => t.id === room?.currentTrackId);
  const playerProgressInSeconds = room?.currentTrackProgress || 0;

  return (
    <>
      <JukeboxAudioHandler />
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
                audioDevices={audioDevices}
                selectedMusicDeviceId={musicDeviceId}
                onMusicDeviceSelect={handleMusicDeviceSelect}
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
        
        <RoomParticipants 
          isHost={isRoomOwner} 
          roomId={roomId}
          micDevices={micDevices}
          activeMicId={activeMicId || ''}
          onMicDeviceChange={handleMicDeviceChange}
        />
      </div>
    </>
  );
}

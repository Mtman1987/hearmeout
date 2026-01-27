'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState, useEffect, useRef } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, deleteField } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants, useMediaDeviceSelect } from '@livekit/components-react';
import { createLocalAudioTrack, LocalTrackPublication, Room } from 'livekit-client';
import ReactPlayer from 'react-player/youtube';
import '@livekit/components-styles';

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
}

const RoomParticipants = ({ isHost, roomId }: { isHost: boolean; roomId: string; }) => {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  // Filter out the Jukebox participant
  const humanParticipants = remoteParticipants.filter(p => p.identity !== 'Jukebox');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
       {localParticipant && (
        <UserCard
          key={localParticipant.sid}
          participant={localParticipant}
          isHost={isHost}
          roomId={roomId}
        />
      )}
      {humanParticipants.map((participant) => (
        <UserCard 
          key={participant.sid}
          participant={participant}
          isHost={isHost}
          roomId={roomId}
        />
      ))}
    </div>
  );
};

export default function UserList({ musicPlayerOpen, roomId }: { musicPlayerOpen: boolean, roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const { firestore, user } = useFirebase();
  const { localParticipant } = useLocalParticipant();
  const { audioDevices } = useMediaDeviceSelect({ kind: 'audioinput' });
  const [musicDeviceId, setMusicDeviceId] = useState<string | undefined>();
  
  const musicTrackPublicationRef = useRef<LocalTrackPublication | null>(null);
  const playerRef = useRef<ReactPlayer>(null);

  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const isRoomOwner = !!user && !!room && user.uid === room.ownerId;

  useEffect(() => {
    if (room && !room.playlist && isRoomOwner) {
        updateDocumentNonBlocking(roomRef!, { 
            playlist: initialPlaylist,
            currentTrackId: initialPlaylist[0].id,
            isPlaying: false
        });
    }
  }, [room, isRoomOwner, roomRef]);
  
  useEffect(() => {
    const setupJukeboxTrack = async () => {
      if (!isRoomOwner || !localParticipant || !musicDeviceId) {
        // If conditions are not met, unpublish any existing track.
        if (musicTrackPublicationRef.current) {
          try {
            await localParticipant.unpublishTrack(musicTrackPublicationRef.current.track, true);
          } catch (e) {
             console.error("Failed to unpublish jukebox track on condition change:", e);
          }
          musicTrackPublicationRef.current = null;
        }
        return;
      }
      
      // Clean up previous track before creating a new one.
      if (musicTrackPublicationRef.current) {
        try {
          await localParticipant.unpublishTrack(musicTrackPublicationRef.current.track, true);
        } catch (e) {
          console.error("Failed to unpublish existing jukebox track:", e);
        }
      }

      // Create and publish the new jukebox track.
      try {
        const track = await createLocalAudioTrack({ deviceId: musicDeviceId });
        const publication = await localParticipant.publishTrack(track, {
          name: 'Jukebox',
          source: 'jukebox',
        });
        musicTrackPublicationRef.current = publication;
      } catch (e) {
        console.error("Failed to create and publish jukebox track:", e);
      }
    };

    setupJukeboxTrack();

    // The main cleanup for when the component unmounts.
    return () => {
      if (musicTrackPublicationRef.current && localParticipant) {
        localParticipant.unpublishTrack(musicTrackPublicationRef.current.track, true)
          .catch(e => console.error("Failed to unpublish jukebox track on unmount:", e));
        musicTrackPublicationRef.current = null;
      }
    };
  }, [isRoomOwner, localParticipant, musicDeviceId]);

  
  const canControlMusic = isRoomOwner;

  const handlePlaySong = (songId: string) => {
    if (!canControlMusic || !roomRef) return;
    updateDocumentNonBlocking(roomRef, {
        currentTrackId: songId,
        isPlaying: true,
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
    setActivePanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  }

  const handleRemoveSong = (songId: string) => {
    if (!isRoomOwner || !roomRef || !room?.playlist) return;
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
    if (!isRoomOwner || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { 
      playlist: [],
      currentTrackId: deleteField(),
      isPlaying: false,
    });
  };

  const currentTrack = room?.playlist?.find(t => t.id === room?.currentTrackId);
  
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
                isPlayerControlAllowed={canControlMusic}
                onPlayPause={handlePlayPause}
                onPlayNext={handlePlayNext}
                onPlayPrev={handlePlayPrev}
                activePanels={activePanels}
                onTogglePanel={handleTogglePanel}
                isRoomOwner={isRoomOwner}
                audioDevices={audioDevices}
                selectedMusicDeviceId={musicDeviceId}
                onMusicDeviceSelect={setMusicDeviceId}
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
        
        <RoomParticipants isHost={isRoomOwner} roomId={roomId}/>
      </div>
    </>
  );
}

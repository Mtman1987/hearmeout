
'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState, useEffect } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from "@/components/ui/card";

const initialPlaylist: PlaylistItem[] = [
  { id: "1", title: "Golden Hour", artist: "JVKE", artId: "album-art-1", url: "https://www.youtube.com/watch?v=c9scA_s1d4A" },
  { id: "2", title: "Sofia", artist: "Clairo", artId: "album-art-2", url: "https://www.youtube.com/watch?v=L9l8zCOwEII" },
  { id: "3", title: "Sweden", artist: "C418", artId: "album-art-3", url: "https://www.youtube.com/watch?v=aBkTkxapoJY" },
];

interface RoomUser {
  id: string; 
  displayName: string;
  photoURL: string;
  isSpeaking: boolean;
}

interface RoomData {
  name: string;
  ownerId: string;
  playlist?: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
}

export default function UserList({ musicPlayerOpen, roomId }: { musicPlayerOpen: boolean, roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const { firestore, user } = useFirebase();

  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  useEffect(() => {
    // Initialize room with a default playlist if it's new
    if (room && !room.playlist && user?.uid === room.ownerId) {
        updateDocumentNonBlocking(roomRef!, { 
            playlist: initialPlaylist,
            currentTrackId: initialPlaylist[0].id,
            isPlaying: false
        });
    }
  }, [room, user, roomRef]);

  const usersInRoomQuery = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return collection(firestore, 'rooms', roomId, 'users');
  }, [firestore, roomId]);

  const { data: users, isLoading: usersLoading } = useCollection<RoomUser>(usersInRoomQuery);
  
  const isHost = !!(room && user && room.ownerId === user.uid);
  const canAddMusic = !!user;
  const canControlMusic = !!user; // Any logged-in user can control music

  const handleMoveUser = (userId: string, destinationRoomId: string) => {
    // This was mock functionality. For now, I'll disable it.
    console.log(`Move user ${userId} to room ${destinationRoomId}`);
  };

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
    if (!canAddMusic || !roomRef || !room) return;
    const newPlaylist = [...(room.playlist || []), ...newItems];
    updateDocumentNonBlocking(roomRef, { playlist: newPlaylist });

    // If nothing is playing, start playing the first new song
    if (!room.isPlaying && room.playlist?.length === (room.playlist?.length - newItems.length)) {
       handlePlaySong(newItems[0].id);
    }
  };

  const handleTogglePanel = (panel: 'playlist' | 'add') => {
    setActivePanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  }

  const currentTrack = room?.playlist?.find(t => t.id === room?.currentTrackId);
  
  return (
    <div className="flex flex-col gap-6">
      {musicPlayerOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1 h-full">
             <MusicPlayerCard
              roomId={roomId}
              currentTrack={currentTrack}
              playlist={room?.playlist || []}
              playing={room?.isPlaying || false}
              isPlayerControlAllowed={canControlMusic}
              onPlayPause={handlePlayPause}
              onPlayNext={handlePlayNext}
              onPlayPrev={handlePlayPrev}
              onSeek={() => {}} // Placeholder for seek
              activePanels={activePanels}
              onTogglePanel={handleTogglePanel}
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
                    />
                </div>
            )}

            {activePanels.add && (
                <div className={activePanels.playlist ? "md:col-span-1" : "md:col-span-2"}>
                    <AddMusicPanel
                        onAddItems={handleAddItems}
                        onClose={() => handleTogglePanel('add')}
                        canAddMusic={canAddMusic}
                    />
                </div>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {usersLoading && Array.from({length: 4}).map((_, i) => <Card key={i}><CardHeader><div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-5 w-3/4" /></div></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>)}
        {users && users.map((roomUser) => (
          <UserCard key={roomUser.id} user={{id: roomUser.id, name: roomUser.displayName, photoURL: roomUser.photoURL, isSpeaking: roomUser.isSpeaking}} isLocal={roomUser.id === user?.uid} isHost={isHost && roomUser.id !== user?.uid} onMoveUser={handleMoveUser} />
        ))}
      </div>
    </div>
  );
}

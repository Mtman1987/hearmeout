'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState, useEffect } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from "@/components/ui/card";

const initialPlaylist: PlaylistItem[] = [
  { id: "1", title: "Golden Hour", artist: "JVKE", artId: "album-art-1", url: "https://www.youtube.com/watch?v=c9scA_s1d4A" },
  { id: "2", title: "Sofia", artist: "Clairo", artId: "album-art-2", url: "https://www.youtube.com/watch?v=L9l8zCOwEII" },
  { id: "3", title: "Sweden", artist: "C418", artId: "album-art-3", url: "https://www.youtube.com/watch?v=aBkTkxapoJY" },
  { id: "4", title: "Don't Stop The Music", artist: "Rihanna", artId: "album-art-1", url: "https://www.youtube.com/watch?v=yd8jh9QYfSM" },
  { id: "5", title: "So What", artist: "Miles Davis", artId: "album-art-2", url: "https://www.youtube.com/watch?v=ylXk1LBvIqU" },
];

interface RoomUser {
  id: string; 
  displayName: string;
  photoURL: string;
  isSpeaking: boolean;
}

export default function UserList({ musicPlayerOpen, roomId, room }: { musicPlayerOpen: boolean, roomId: string, room: { ownerId: string } | null }) {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>(initialPlaylist);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const [playing, setPlaying] = useState(false);
  
  const { firestore, user } = useFirebase();

  const usersInRoomQuery = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return collection(firestore, 'rooms', roomId, 'users');
  }, [firestore, roomId]);

  const { data: users, isLoading: usersLoading } = useCollection<RoomUser>(usersInRoomQuery);
  
  const isHost = !!(room && user && room.ownerId === user.uid);

  const handleMoveUser = (userId: string, destinationRoomId: string) => {
    // This was mock functionality. For now, I'll disable it.
    console.log(`Move user ${userId} to room ${destinationRoomId}`);
  };


  const playSong = (index: number) => {
    setCurrentTrackIndex(index);
    setPlaying(true);
  }

  const handlePlayNext = () => {
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    playSong(nextIndex);
  };

  const handlePlayPrev = () => {
    const prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    playSong(prevIndex);
  };

  const handleAddItems = (newItems: PlaylistItem[]) => {
    const newPlaylist = [...playlist, ...newItems];
    setPlaylist(newPlaylist);
    if (!playing && playlist.length === initialPlaylist.length) {
       playSong(playlist.length);
    }
  };

  const handleTogglePanel = (panel: 'playlist' | 'add') => {
    setActivePanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  }

  const currentTrack = playlist[currentTrackIndex] || initialPlaylist[0];
  
  return (
    <div className="flex flex-col gap-6">
      {musicPlayerOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1 h-full">
             <MusicPlayerCard
              currentTrack={currentTrack}
              playing={playing}
              setPlaying={setPlaying}
              onPlayNext={handlePlayNext}
              onPlayPrev={handlePlayPrev}
              activePanels={activePanels}
              onTogglePanel={handleTogglePanel}
            />
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {activePanels.playlist && (
                <div className={activePanels.add ? "md:col-span-1" : "md:col-span-2"}>
                    <PlaylistPanel
                        playlist={playlist}
                        onPlaySong={playSong}
                        currentTrackId={currentTrack.id}
                    />
                </div>
            )}

            {activePanels.add && (
                <div className={activePanels.playlist ? "md:col-span-1" : "md:col-span-2"}>
                    <AddMusicPanel
                        onAddItems={handleAddItems}
                        onClose={() => handleTogglePanel('add')}
                    />
                </div>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {usersLoading && Array.from({length: 4}).map((_, i) => <Card key={i}><CardHeader><div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-5 w-3/4" /></div></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>)}
        {users && users.map((roomUser) => (
          <UserCard key={roomUser.id} user={{id: roomUser.id, name: roomUser.displayName, photoURL: roomUser.photoURL, isSpeaking: roomUser.isSpeaking}} isLocal={roomUser.id === user?.uid} isHost={isHost} onMoveUser={handleMoveUser} />
        ))}
      </div>
    </div>
  );
}

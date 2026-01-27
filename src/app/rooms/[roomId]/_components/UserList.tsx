'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState, useEffect } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";

const allMockUsers = [
  { id: 2, name: "Mike", avatarId: "avatar-2", isSpeaking: false },
  { id: 4, name: "David", avatarId: "avatar-4", isSpeaking: false },
  { id: 5, name: "Chloe", avatarId: "avatar-1", isSpeaking: false },
  { id: 6, name: "Alex", avatarId: "avatar-2", isSpeaking: false },
  { id: 7, name: "Sarah", avatarId: "avatar-1", isSpeaking: false },
  { id: 8, name: "Ben", avatarId: "avatar-4", isSpeaking: false },
  { id: 9, name: "Emily", avatarId: "avatar-3", isSpeaking: false },
];

const usersByRoom: { [key: string]: typeof allMockUsers } = {
    "1": [allMockUsers[0], allMockUsers[2], allMockUsers[3]], // Lofi: Mike, Chloe, Alex
    "2": [allMockUsers[1], allMockUsers[4]], // Indie: David, Sarah
    "3": [allMockUsers[0], allMockUsers[1], allMockUsers[5], allMockUsers[6]], // Throwback: Mike, David, Ben, Emily
    "4": [allMockUsers[3], allMockUsers[4]], // Gaming: Alex, Sarah
    "5": [allMockUsers[5]], // Jazz: Ben
    "6": [allMockUsers[0], allMockUsers[1]], // Rock: Mike, David
};

const youUser = { id: 3, name: "You", avatarId: "avatar-3", isSpeaking: false };


const initialPlaylist: PlaylistItem[] = [
  { id: "1", title: "Golden Hour", artist: "JVKE", artId: "album-art-1", url: "https://www.youtube.com/watch?v=c9scA_s1d4A" },
  { id: "2", title: "Sofia", artist: "Clairo", artId: "album-art-2", url: "https://www.youtube.com/watch?v=L9l8zCOwEII" },
  { id: "3", title: "Sweden", artist: "C418", artId: "album-art-3", url: "https://www.youtube.com/watch?v=aBkTkxapoJY" },
  { id: "4", title: "Don't Stop The Music", artist: "Rihanna", artId: "album-art-1", url: "https://www.youtube.com/watch?v=yd8jh9QYfSM" },
  { id: "5", title: "So What", artist: "Miles Davis", artId: "album-art-2", url: "https://www.youtube.com/watch?v=ylXk1LBvIqU" },
];


export default function UserList({ musicPlayerOpen, roomId }: { musicPlayerOpen: boolean, roomId: string }) {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>(initialPlaylist);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const [playing, setPlaying] = useState(false);
  
  const getInitialUsers = () => {
    const roomUsers = usersByRoom[roomId] || [];
    return [youUser, ...roomUsers];
  }

  const [users, setUsers] = useState(getInitialUsers());

  // Update users when room changes
  useEffect(() => {
    setUsers(getInitialUsers());
  }, [roomId]);

  const isHost = users.some(u => u.name === "You");

  const removeUser = (userId: number) => {
    setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
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
        {users.map((user) => (
          <UserCard key={user.id} user={user} isLocal={user.name === "You"} isHost={isHost} onMoveUser={removeUser} />
        ))}
      </div>
    </div>
  );
}

'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";

const users = [
  { id: 3, name: "You", avatarId: "avatar-3", isSpeaking: false },
  { id: 1, name: "Sarah", avatarId: "avatar-1", isSpeaking: true },
  { id: 2, name: "Mike", avatarId: "avatar-2", isSpeaking: false },
  { id: 4, name: "David", avatarId: "avatar-4", isSpeaking: false },
  { id: 5, name: "Chloe", avatarId: "avatar-1", isSpeaking: false },
  { id: 6, name: "Alex", avatarId: "avatar-2", isSpeaking: false },
];

const initialPlaylist: PlaylistItem[] = [
  { id: "1", title: "Golden Hour", artist: "JVKE", artId: "album-art-1", url: "https://www.youtube.com/watch?v=c9scA_s1d4A" },
  { id: "2", title: "Sofia", artist: "Clairo", artId: "album-art-2", url: "https://www.youtube.com/watch?v=L9l8zCOwEII" },
  { id: "3", title: "Sweden", artist: "C418", artId: "album-art-3", url: "https://www.youtube.com/watch?v=aBkTkxapoJY" },
  { id: "4", title: "Don't Stop The Music", artist: "Rihanna", artId: "album-art-1", url: "https://www.youtube.com/watch?v=yd8jh9QYfSM" },
  { id: "5", title: "So What", artist: "Miles Davis", artId: "album-art-2", url: "https://www.youtube.com/watch?v=ylXk1LBvIqU" },
];


export default function UserList({ musicPlayerOpen }: { musicPlayerOpen: boolean }) {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>(initialPlaylist);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const [playing, setPlaying] = useState(false);
  const isHost = users.some(u => u.name === "You");

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-1">
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
          <UserCard key={user.id} user={user} isLocal={user.name === "You"} isHost={isHost} />
        ))}
      </div>
    </div>
  );
}

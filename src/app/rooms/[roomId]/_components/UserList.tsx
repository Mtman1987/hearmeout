'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState, useEffect } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, deleteField } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { generateLiveKitToken } from '@/app/actions';
import {
  LiveKitRoom,
  useLocalParticipant,
  useRemoteParticipants,
} from '@livekit/components-react';
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
      {remoteParticipants.map((participant) => (
        <UserCard 
          key={participant.sid}
          participant={participant}
          isHost={isHost}
          roomId={roomId}
        />
      ))}
      {(!localParticipant && remoteParticipants.length === 0) &&
         Array.from({length: 4}).map((_, i) => <Card key={i}><CardHeader><div className="flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-full" /><div className="w-3/4 space-y-2"><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-1/2" /></div></div></CardHeader><CardContent><div className="space-y-2"><Skeleton className="h-2 w-full" /><Skeleton className="h-10 w-full" /></div></CardContent></Card>)
      }
    </div>
  );
};

export default function UserList({ musicPlayerOpen, roomId }: { musicPlayerOpen: boolean, roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const { firestore, user, isUserLoading } = useFirebase();
  const { toast } = useToast();

  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  useEffect(() => {
    if (isUserLoading || !user?.uid) {
      return;
    }

    const participantIdentity = user.uid;
    const participantName = user.displayName || 'Guest';
    const participantMetadata = JSON.stringify({ photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100` });

    (async () => {
      try {
        const token = await generateLiveKitToken(roomId, participantIdentity, participantName, participantMetadata);
        setLivekitToken(token);
      } catch (e) {
        console.error('[UserList] Failed to get LiveKit token', e);
        toast({
          variant: 'destructive',
          title: 'Voice Connection Failed',
          description: 'Could not generate an authentication token for the voice server.',
        });
      }
    })();
  }, [user, isUserLoading, roomId, toast]);

  useEffect(() => {
    if (room && !room.playlist && user?.uid === room.ownerId) {
        updateDocumentNonBlocking(roomRef!, { 
            playlist: initialPlaylist,
            currentTrackId: initialPlaylist[0].id,
            isPlaying: false
        });
    }
  }, [room, user, roomRef]);
  
  const isRoomOwner = !!user && !!room && user.uid === room.ownerId;
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
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  
  return (
    <>
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
                onSeek={() => {}} 
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
        
        {livekitToken && livekitUrl ? (
          <LiveKitRoom
            serverUrl={livekitUrl}
            token={livekitToken}
            connect={true}
            audio={true}
            video={false}
          >
            <RoomParticipants isHost={isRoomOwner} roomId={roomId}/>
          </LiveKitRoom>
        ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
             {Array.from({length: 4}).map((_, i) => <Card key={i}><CardHeader><div className="flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-full" /><div className="w-3/4 space-y-2"><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-1/2" /></div></div></CardHeader><CardContent><div className="space-y-2"><Skeleton className="h-2 w-full" /><Skeleton className="h-10 w-full" /></div></CardContent></Card>)}
           </div>
        )}
      </div>
    </>
  );
}

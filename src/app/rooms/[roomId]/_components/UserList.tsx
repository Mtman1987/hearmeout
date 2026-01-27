'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState, useEffect } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, arrayUnion, updateDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { MoveUserDialog } from './MoveUserDialog';
import { generateLiveKitToken } from '@/app/actions';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  useParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';


const initialPlaylist: PlaylistItem[] = [
  { id: "1", title: "Golden Hour", artist: "JVKE", artId: "album-art-1", url: "https://www.youtube.com/watch?v=c9scA_s1d4A" },
  { id: "2", title: "Sofia", artist: "Clairo", artId: "album-art-2", url: "https://www.youtube.com/watch?v=L9l8zCOwEII" },
  { id: "3", title: "Sweden", artist: "C418", artId: "album-art-3", url: "https://www.youtube.com/watch?v=aBkTkxapoJY" },
];

interface RoomUser {
  id: string; 
  displayName: string;
  photoURL: string;
}

interface RoomData {
  name: string;
  ownerId: string;
  playlist?: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
}

interface UserToMove {
    id: string;
    name: string;
}

const RoomParticipants = ({
  isHost,
  isRoomOwner,
  onDeleteRoom,
  handleKickUser,
  handleBanUser,
  handleMuteUser,
  handleMoveInitiate
}: {
  isHost: boolean;
  isRoomOwner: boolean;
  onDeleteRoom: () => void;
  handleKickUser: (userId: string) => void;
  handleBanUser: (userId: string) => void;
  handleMuteUser: (userId: string, shouldMute: boolean) => void;
  handleMoveInitiate: (user: UserToMove) => void;
}) => {
  const participants = useParticipants();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {participants.map((participant) => (
        <UserCard 
          key={participant.sid}
          user={{
            id: participant.identity,
            name: participant.name || participant.identity,
            photoURL: participant.metadata ? JSON.parse(participant.metadata).photoURL : '',
            isSpeaking: participant.isSpeaking,
            isMutedByHost: participant.isMicrophoneMuted,
          }}
          isLocal={participant.isLocal}
          isHost={isHost && !participant.isLocal}
          onKick={handleKickUser}
          onBan={handleBanUser}
          onMute={handleMuteUser}
          onMove={handleMoveInitiate}
          isRoomOwner={participant.isLocal && isRoomOwner}
          onDeleteRoom={participant.isLocal ? onDeleteRoom : undefined}
        />
      ))}
    </div>
  );
};


export default function UserList({ musicPlayerOpen, roomId }: { musicPlayerOpen: boolean, roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const [userToMove, setUserToMove] = useState<UserToMove | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

   useEffect(() => {
    if (!user || !roomId) return;

    (async () => {
      try {
        const token = await generateLiveKitToken(roomId, user.uid);
        setLivekitToken(token);
      } catch (e) {
        console.error('Failed to get LiveKit token', e);
        toast({
          variant: 'destructive',
          title: 'Voice Connection Failed',
          description: 'Could not connect to the voice server.',
        });
      }
    })();
  }, [user, roomId, toast]);

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

  const handleKickUser = (userId: string) => {
    if (!isHost || !firestore) return;
    const userToKickRef = doc(firestore, 'rooms', roomId, 'users', userId);
    deleteDocumentNonBlocking(userToKickRef);
    // In a real app, you would also use LiveKit's server API to kick the user from the room.
    toast({ title: "User Kicked", description: "The user has been removed from the room." });
  };

  const handleBanUser = (userId: string) => {
    if (!isHost || !firestore) return;
    const roomDocRef = doc(firestore, 'rooms', roomId);
    
    // Ban first, then kick.
    updateDoc(roomDocRef, {
        bannedUsers: arrayUnion(userId)
    }).then(() => {
        handleKickUser(userId); // Kick them after they are successfully banned.
        toast({ title: "User Banned", description: "The user has been banned and removed from the room." });
    }).catch(error => {
        console.error("Failed to ban user:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not ban the user." });
    });
  };

  const handleDeleteRoom = () => {
    if (!isHost || !roomRef) return;
    deleteDocumentNonBlocking(roomRef);
    toast({
      title: "Room Deleted",
      description: "The room has been successfully deleted.",
    });
    router.push('/');
  };

  const handleMuteUser = (userId: string, shouldMute: boolean) => {
     if (!isHost || !firestore) return;
    // This would now be handled by LiveKit server API to mute the participant for everyone.
    // The UI is just an example of what a host could do.
    toast({ title: `User ${shouldMute ? 'Muted' : 'Unmuted'}`, description: `(Simulated) The user has been ${shouldMute ? 'muted' : 'unmuted'} for everyone in the room.` });
  };
  
  const handleMoveInitiate = (user: UserToMove) => {
    setUserToMove(user);
  };
  
  const handleMoveUser = async (targetRoomId: string) => {
    if (!userToMove || !firestore || !users) return;

    const sourceRoomId = roomId;
    const userIdToMove = userToMove.id;

    const userToMoveData = users.find(u => u.id === userIdToMove);

    if (!userToMoveData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find user data to move.' });
        return;
    }

    const sourceUserDocRef = doc(firestore, 'rooms', sourceRoomId, 'users', userIdToMove);
    const targetUserDocRef = doc(firestore, 'rooms', targetRoomId, 'users', userIdToMove);

    deleteDocumentNonBlocking(sourceUserDocRef);
    const { id, ...restOfUserData } = userToMoveData;
    setDocumentNonBlocking(targetUserDocRef, restOfUserData, { merge: false });

    toast({ title: "User Moved", description: `${userToMove.name} has been moved to a new room.` });
    setUserToMove(null);
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

    if (!room.isPlaying && room.playlist?.length === (room.playlist?.length - newItems.length)) {
       handlePlaySong(newItems[0].id);
    }
  };

  const handleTogglePanel = (panel: 'playlist' | 'add') => {
    setActivePanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  }

  const currentTrack = room?.playlist?.find(t => t.id === room?.currentTrackId);
  
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
        
        {livekitToken && process.env.NEXT_PUBLIC_LIVEKIT_URL ? (
          <LiveKitRoom
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            token={livekitToken}
            connect={true}
            video={false}
            audio={true}
            userChoices={{
              username: user?.displayName || user?.uid,
            }}
             onDisconnected={() => setLivekitToken(null)}
          >
            <RoomParticipants 
              isHost={isHost}
              isRoomOwner={isHost}
              onDeleteRoom={handleDeleteRoom} 
              handleBanUser={handleBanUser} 
              handleKickUser={handleKickUser}
              handleMuteUser={handleMuteUser}
              handleMoveInitiate={handleMoveInitiate}
            />
          </LiveKitRoom>
        ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
             {Array.from({length: 4}).map((_, i) => <Card key={i}><CardHeader><div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-5 w-3/4" /></div></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>)}
           </div>
        )}
      </div>
       {userToMove && (
          <MoveUserDialog
              userToMove={userToMove}
              currentRoomId={roomId}
              onMoveUser={handleMoveUser}
              onOpenChange={(open) => !open && setUserToMove(null)}
          />
      )}
    </>
  );
}

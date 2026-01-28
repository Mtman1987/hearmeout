'use client';

import UserCard from "./UserCard";
import React from "react";
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';
import '@livekit/components-styles';

export interface RoomData {
  name: string;
  ownerId: string;
  djId?: string;
  djDisplayName?: string;
}

export default function UserList({ 
    roomId,
    isPlaying,
    onTogglePanel,
    activePanels,
}: { 
    roomId: string, 
    isPlaying: boolean,
    onTogglePanel: (panel: 'playlist' | 'add') => void;
    activePanels: { playlist: boolean, add: boolean };
}) {
  const { firestore, user } = useFirebase();
  
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const jukeboxParticipant = remoteParticipants.find(p => p.identity.endsWith('-jukebox'));
  const voiceParticipants = remoteParticipants.filter(p => !p.identity.endsWith('-jukebox'));

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card for Local User's Voice */}
          {localParticipant && (
            <UserCard
              key={`${localParticipant.sid}-voice`}
              participant={localParticipant}
              isLocal={true}
              isHost={localParticipant.identity === room?.ownerId}
              roomId={roomId}
              isJukebox={false}
            />
          )}

          {/* Card for Jukebox */}
          {jukeboxParticipant && isPlaying && (
             <UserCard
              key={jukeboxParticipant.sid}
              participant={jukeboxParticipant}
              isLocal={false}
              isHost={false} 
              roomId={roomId}
              isJukebox={true}
              onTogglePanel={onTogglePanel}
              activePanels={activePanels}
            />
          )}

          {/* Cards for Remote Users */}
          {voiceParticipants.map((participant) => (
            <UserCard
              key={participant.sid}
              participant={participant}
              isLocal={false}
              isHost={participant.identity === room?.ownerId}
              roomId={roomId}
              isJukebox={false}
            />
          ))}
        </div>
      </div>
    </>
  );
}

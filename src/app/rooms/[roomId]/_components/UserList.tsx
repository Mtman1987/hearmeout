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
    jukeboxVolume,
    onJukeboxVolumeChange,
}: { 
    roomId: string, 
    isPlaying: boolean,
    onTogglePanel: (panel: 'playlist' | 'add') => void;
    activePanels: { playlist: boolean, add: boolean };
    jukeboxVolume: number;
    onJukeboxVolumeChange: (volume: number) => void;
}) {
  const { firestore, user } = useFirebase();
  
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);
  const isJukeboxVisible = isPlaying;

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
              audioType="voice"
            />
          )}

          {/* Card for Jukebox (Music Stream from Local User) */}
          {localParticipant && isJukeboxVisible && (
            <UserCard
              key={`${localParticipant.sid}-music`}
              participant={localParticipant}
              isLocal={true}
              isHost={false} 
              roomId={roomId}
              audioType="music"
              onTogglePanel={onTogglePanel}
              activePanels={activePanels}
              jukeboxVolume={jukeboxVolume}
              onJukeboxVolumeChange={onJukeboxVolumeChange}
            />
          )}

          {/* Cards for Remote Users */}
          {remoteParticipants.map((participant) => (
            <UserCard
              key={participant.sid}
              participant={participant}
              isLocal={false}
              isHost={participant.identity === room?.ownerId}
              roomId={roomId}
              audioType="voice"
            />
          ))}
        </div>
      </div>
    </>
  );
}

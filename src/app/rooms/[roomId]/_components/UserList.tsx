'use client';

import UserCard from "./UserCard";
import React from "react";
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';
import '@livekit/components-styles';
import { Card, CardContent } from "@/components/ui/card";
import { LoaderCircle } from "lucide-react";

export interface RoomData {
  name: string;
  ownerId: string;
  djId?: string;
  djDisplayName?: string;
}

export default function UserList({ 
    roomId,
    onTogglePanel,
    activePanels,
    isJukeboxVisible,
}: { 
    roomId: string, 
    onTogglePanel: (panel: 'playlist' | 'add') => void;
    activePanels: { playlist: boolean, add: boolean };
    isJukeboxVisible: boolean;
}) {
  const { firestore } = useFirebase();
  
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
          {/* Card for Jukebox */}
          {isJukeboxVisible && (
            jukeboxParticipant ? (
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
            ) : (
              <Card className="flex flex-col h-full">
                <CardContent className="p-4 flex flex-col gap-4 flex-grow items-center justify-center">
                    <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm">Connecting Jukebox...</p>
                </CardContent>
              </Card>
            )
          )}

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

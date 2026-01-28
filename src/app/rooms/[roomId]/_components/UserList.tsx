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

export default function UserList({ roomId, jukeboxAudioStream }: { roomId: string, jukeboxAudioStream: MediaStream | null }) {
  const { firestore } = useFirebase();
  
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  
  const participants = [
    ...(localParticipant ? [localParticipant] : []),
    ...remoteParticipants,
  ];

  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const jukeboxAudioTrack = jukeboxAudioStream ? jukeboxAudioStream.getAudioTracks()[0] : null;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {participants.map((participant) => {
              const isLocal = participant.sid === localParticipant?.sid;

              if (isLocal) {
                 return (
                    <UserCard
                      key={participant.sid}
                      participant={participant}
                      isLocal={true}
                      isHost={participant.identity === room?.ownerId}
                      roomId={roomId}
                      isActingAsJukebox={true}
                      jukeboxAudioTrack={jukeboxAudioTrack}
                    />
                )
              } else {
                return (
                  <UserCard
                    key={participant.sid}
                    participant={participant}
                    isLocal={false}
                    isHost={participant.identity === room?.ownerId}
                    roomId={roomId}
                  />
                )
              }
            })
          }
        </div>
      </div>
    </>
  );
}

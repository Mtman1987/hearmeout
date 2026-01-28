'use client';

import UserCard from "./UserCard";
import React, { useState, useEffect } from "react";
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants, useMediaDeviceSelect } from '@livekit/components-react';
import '@livekit/components-styles';
import * as LivekitClient from 'livekit-client';


export interface RoomData {
  name: string;
  ownerId: string;
  djId?: string;
  djDisplayName?: string;
}

export default function UserList({ roomId }: { roomId: string }) {
  const { firestore } = useFirebase();
  
  // LiveKit Hooks
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  
  const participants = [
    ...(localParticipant ? [localParticipant] : []),
    ...remoteParticipants,
  ];

  const { 
    devices: micDevices, 
    activeDeviceId: activeMicId, 
    setActiveMediaDevice: setMicDevice 
  } = useMediaDeviceSelect({ kind: 'audioinput' });
  
  const { 
    devices: speakerDevices, 
    activeDeviceId: activeSpeakerId, 
    setActiveMediaDevice: setSpeakerDevice 
  } = useMediaDeviceSelect({ kind: 'audiooutput' });


  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const handleMicDeviceChange = (deviceId: string) => {
      setMicDevice(deviceId);
      try {
          localStorage.setItem('hearmeout-user-mic-device-id', deviceId);
      } catch (e) {
          console.error("Failed to save mic device to localStorage", e);
      }
  };

  const handleSpeakerDeviceChange = (deviceId: string) => {
    setSpeakerDevice(deviceId);
    try {
      localStorage.setItem('hearmeout-user-speaker-device-id', deviceId);
    } catch (e) {
      console.error("Failed to save speaker device to localStorage", e);
    }
  }

  useEffect(() => {
      if (speakerDevices.length > 0) {
          const savedSpeakerId = localStorage.getItem('hearmeout-user-speaker-device-id');
          if (savedSpeakerId && speakerDevices.some(d => d.deviceId === savedSpeakerId)) {
              setSpeakerDevice(savedSpeakerId);
          }
      }
  }, [speakerDevices, setSpeakerDevice]);

  useEffect(() => {
    if (micDevices.length > 0) {
        const savedUserMicId = localStorage.getItem('hearmeout-user-mic-device-id');
        if (savedUserMicId && micDevices.some(d => d.deviceId === savedUserMicId)) {
            setMicDevice(savedUserMicId);
        }
    }
  }, [micDevices, setMicDevice]);


  useEffect(() => {
    if (localParticipant && activeMicId) {
      const audioOptions: LivekitClient.AudioCaptureOptions = { deviceId: activeMicId };
      localParticipant.setMicrophoneEnabled(true, audioOptions);
    }
  }, [localParticipant, activeMicId]);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {participants.map((participant) => {
              const isLocal = participant.sid === localParticipant?.sid;
              // When the user joins, their card will render as the Jukebox.
              const isActingAsJukebox = isLocal;

              // Do not render the user's original card if they are the jukebox
              if (isLocal && isActingAsJukebox && participants.length > 1) {
                  const regularUser = { ...participant };
                  // We render a normal card for the user that is silent
                  return <UserCard
                      key={regularUser.sid + "-clone"}
                      participant={regularUser}
                      isLocal={true}
                      isHost={regularUser.identity === room?.ownerId}
                      roomId={roomId}
                      isActingAsJukebox={false}
                      micDevices={micDevices}
                      speakerDevices={speakerDevices}
                      activeMicId={activeMicId}
                      activeSpeakerId={activeSpeakerId}
                      onMicDeviceChange={handleMicDeviceChange}
                      onSpeakerDeviceChange={handleSpeakerDeviceChange}
                   />;
              }
              
              // Render Jukebox card for the local participant
              if(isLocal){
                return (
                    <UserCard
                    key={participant.sid}
                    participant={participant}
                    isLocal={true}
                    isHost={participant.identity === room?.ownerId}
                    roomId={roomId}
                    isActingAsJukebox={true}
                    micDevices={micDevices}
                    speakerDevices={speakerDevices}
                    activeMicId={activeMicId}
                    activeSpeakerId={activeSpeakerId}
                    onMicDeviceChange={handleMicDeviceChange}
                    onSpeakerDeviceChange={handleSpeakerDeviceChange}
                    />
                )
              }

              // Render normal cards for all other participants
              return (
                <UserCard
                  key={participant.sid}
                  participant={participant}
                  isLocal={false}
                  isHost={participant.identity === room?.ownerId}
                  roomId={roomId}
                  isActingAsJukebox={false}
                />
              )
            })
          }
        </div>
      </div>
    </>
  );
}

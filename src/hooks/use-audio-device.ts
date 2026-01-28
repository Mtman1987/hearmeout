
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import * as LivekitClient from 'livekit-client';

type UseAudioDeviceProps = {
  kind: 'audioinput' | 'audiooutput';
};

export function useAudioDevice({ kind }: UseAudioDeviceProps) {
  const room = useRoomContext();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');

  const getDevices = useCallback(async () => {
    const allDevices = await LivekitClient.enumerateDevices();
    const filteredDevices = allDevices.filter((d) => d.kind === kind);
    setDevices(filteredDevices);

    // Set initial active device
    if (kind === 'audioinput') {
      const activeDevice = room.getActiveDevice('audioinput');
      if (activeDevice) setActiveDeviceId(activeDevice);
    } else if (kind === 'audiooutput') {
      // For output, it's managed differently, often at the room or audio element level
      // LiveKit doesn't have a single `getActiveDevice` for output in the same way.
      // We often default to the system default 'default'.
      setActiveDeviceId('default');
    }

  }, [kind, room]);

  useEffect(() => {
    getDevices();
    room.on(LivekitClient.RoomEvent.ActiveDeviceChanged, (kind, deviceId) => {
        if(kind === kind) {
            setActiveDeviceId(deviceId);
        }
    });
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
      room.removeAllListeners(LivekitClient.RoomEvent.ActiveDeviceChanged);
    };
  }, [getDevices, room, kind]);

  const setDevice = useCallback(async (deviceId: string) => {
    if (kind === 'audioinput') {
      await room.switchActiveDevice(kind, deviceId);
      setActiveDeviceId(deviceId);
    } else if (kind === 'audiooutput') {
      await room.setAudioOutput({ deviceId });
      setActiveDeviceId(deviceId);
    }
  }, [kind, room]);

  return { devices, activeDeviceId, setDevice };
}

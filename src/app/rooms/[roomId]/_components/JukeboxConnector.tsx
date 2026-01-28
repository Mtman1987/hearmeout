'use client';

import { useEffect } from 'react';
import { Room } from 'livekit-client';
import { generateLiveKitToken } from '@/app/actions';

interface JukeboxConnectorProps {
  roomId: string;
}

// This component's sole purpose is to create a silent, "dead" connection
// for the Jukebox participant when a user becomes a DJ. It renders nothing.
export default function JukeboxConnector({ roomId }: JukeboxConnectorProps) {
  useEffect(() => {
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!livekitUrl) {
      console.error('LiveKit URL is not configured in environment variables (NEXT_PUBLIC_LIVEKIT_URL).');
      return;
    }

    const room = new Room();
    let isConnected = false;

    const connectJukebox = async () => {
      try {
        const token = await generateLiveKitToken(
          roomId,
          'jukebox', // The stable identity for our bot
          'Jukebox', // The display name
          '{}'       // Empty metadata
        );
        
        await room.connect(livekitUrl, token, {
          // We don't need this participant to subscribe to any other tracks.
          autoSubscribe: false,
        });
        
        isConnected = true;
        console.log('Jukebox participant silently connected to room:', roomId);

      } catch (error) {
        console.error('Failed to connect Jukebox participant:', error);
      }
    };

    connectJukebox();

    // Disconnect when the component unmounts (i.e., when the DJ leaves or closes the player)
    return () => {
      if (isConnected) {
        room.disconnect();
        console.log('Jukebox participant disconnected.');
      }
    };
  }, [roomId]); // Re-run the effect if the roomId changes

  return null; // This component does not render anything to the DOM
}

'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import { useState, useEffect, useRef } from "react";
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, deleteField } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants, useMediaDeviceSelect } from '@livekit/components-react';
import { createLocalAudioTrack, LocalTrackPublication, Room } from 'livekit-client';
import ReactPlayer from 'react-player/youtube';
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

  // Filter out the Jukebox participant
  const humanParticipants = remoteParticipants.filter(p => p.identity !== 'Jukebox');

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
      {humanParticipants.map((participant) => (
        <UserCard 
          key={participant.sid}
          participant={participant}
          isHost={isHost}
          roomId={roomId}
        />
      ))}
    </div>
  );
};

export default function UserList({ musicPlayerOpen, roomId }: { musicPlayerOpen: boolean, roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const { firestore, user } = useFirebase();
  const { localParticipant } = useLocalParticipant();
  const { audioDevices } = useMediaDeviceSelect({ kind: 'audioinput' });
  const [musicDeviceId, setMusicDeviceId] = useState<string | undefined>();
  const [musicTrackPublication, setMusicTrackPublication] = useState<LocalTrackPublication | null>(null);

  const playerRef = useRef<ReactPlayer>(null);

  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const isRoomOwner = !!user && !!room && user.uid === room.ownerId;

  useEffect(() => {
    if (room && !room.playlist && isRoomOwner) {
        updateDocumentNonBlocking(roomRef!, { 
            playlist: initialPlaylist,
            currentTrackId: initialPlaylist[0].id,
            isPlaying: false
        });
    }
  }, [room, isRoomOwner, roomRef]);
  
  useEffect(() => {
    if (!isRoomOwner || !localParticipant || !musicDeviceId) {
        return;
    }

    let musicTrack: Awaited<ReturnType<typeof createLocalAudioTrack>> | null = null;
    
    // Function to capture audio from the invisible ReactPlayer
    const captureAndPublish = async () => {
        // Stop any existing track
        if (musicTrackPublication) {
            await localParticipant.unpublishTrack(musicTrackPublication.track, true);
        }
        if (musicTrack) {
           musicTrack.stop();
        }

        try {
            // Get the HTML5 video element from ReactPlayer
            const videoElement = playerRef.current?.getInternalPlayer() as HTMLVideoElement;
            if (!videoElement) {
                console.error("Could not get internal player element.");
                return;
            }
            videoElement.crossOrigin = "anonymous"; // Important for capturing audio

            // @ts-ignore - captureStream is present on HTMLMediaElement
            const stream: MediaStream = videoElement.captureStream ? videoElement.captureStream() : videoElement.mozCaptureStream ? videoElement.mozCaptureStream() : null;
            if (!stream || stream.getAudioTracks().length === 0) {
                 console.error("Player is not ready or has no audio track.");
                 // Retry after a short delay
                 setTimeout(captureAndPublish, 500);
                 return;
            }
            
            // Create a local audio track from the player's stream
            musicTrack = await createLocalAudioTrack({
                deviceId: musicDeviceId, // This is a bit of a misnomer, we're not using a device
            });

            // We need to replace the track's underlying MediaStreamTrack with the one from the player
            const playerAudioTrack = stream.getAudioTracks()[0];
            await musicTrack.replaceTrack(playerAudioTrack);

            const publication = await localParticipant.publishTrack(musicTrack, {
                name: 'Jukebox',
                source: 'jukebox',
            });
            setMusicTrackPublication(publication);

        } catch (e) {
            console.error("Error capturing or publishing music track:", e);
        }
    };
    
    // Instead of using the selected device, we now capture the stream from the player
    // This effect now needs to re-run when the track changes or player becomes ready
    // We'll call this function manually when needed. For now, let's tie it to deviceId change.
    
    if (playerRef.current) {
        // Attempt to publish when the device is selected.
        // A better approach might be to wait for the player to be 'onReady'
    }

    const setupJukeboxTrack = async () => {
      // Clean up previous track if it exists
      if (musicTrackPublication) {
        await localParticipant.unpublishTrack(musicTrackPublication.track, true);
      }
      if (musicTrack) {
        musicTrack.stop();
      }

      // Create a new audio track for the Jukebox
      const track = await createLocalAudioTrack({ deviceId: musicDeviceId });
      const publication = await localParticipant.publishTrack(track, {
        name: 'Jukebox', // This name might not be directly visible but is good for metadata
        source: 'jukebox', // Custom source to identify it
      });

      // Set a different identity for the publication if possible, or handle on client
      // For simplicity, we filter by source or name client-side.
      // LiveKit doesn't let you set a different identity for a track, the participant is the identity.
      // So we will create a "Jukebox" participant instead. This requires a second token.
      
      setMusicTrackPublication(publication);
    }
    
    setupJukeboxTrack();

    // Cleanup function
    return () => {
        if (musicTrackPublication) {
            localParticipant.unpublishTrack(musicTrackPublication.track, true);
        }
        if (musicTrack) {
            musicTrack.stop();
        }
    };

  }, [isRoomOwner, localParticipant, musicDeviceId]);

  
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
  
  return (
    <>
      <div className="flex flex-col gap-6">
        {musicPlayerOpen && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1 h-full">
               <MusicPlayerCard
                ref={playerRef}
                roomId={roomId}
                currentTrack={currentTrack}
                playlist={room?.playlist || []}
                playing={room?.isPlaying || false}
                isPlayerControlAllowed={canControlMusic}
                onPlayPause={handlePlayPause}
                onPlayNext={handlePlayNext}
                onPlayPrev={handlePlayPrev}
                activePanels={activePanels}
                onTogglePanel={handleTogglePanel}
                isRoomOwner={isRoomOwner}
                audioDevices={audioDevices}
                selectedMusicDeviceId={musicDeviceId}
                onMusicDeviceSelect={setMusicDeviceId}
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
        
        <RoomParticipants isHost={isRoomOwner} roomId={roomId}/>
      </div>
    </>
  );
}

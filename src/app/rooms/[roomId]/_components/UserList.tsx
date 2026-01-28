'use client';

import UserCard from "./UserCard";
import MusicPlayerCard from "./MusicPlayerCard";
import React, { useState, useEffect, useRef } from "react";
import ReactPlayer from 'react-player/youtube';
import type { PlaylistItem } from "./Playlist";
import PlaylistPanel from "./PlaylistPanel";
import AddMusicPanel from "./AddMusicPanel";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, deleteField } from 'firebase/firestore';
import { useLocalParticipant, useRemoteParticipants, useMediaDeviceSelect, useTracks } from '@livekit/components-react';
import '@livekit/components-styles';
import { useToast } from "@/hooks/use-toast";
import MusicJukeboxCard from "./MusicJukeboxCard";
import * as LivekitClient from 'livekit-client';

const initialPlaylist: PlaylistItem[] = [
  { id: "1", title: "Golden Hour", artist: "JVKE", artId: "album-art-1", url: "https://www.youtube.com/watch?v=c9scA_s1d4A" },
  { id: "2", title: "Sofia", artist: "Clairo", artId: "album-art-2", url: "https://www.youtube.com/watch?v=L9l8zCOwEII" },
  { id: "3", title: "Sweden", artist: "C418", artId: "album-art-3", url: "https://www.youtube.com/watch?v=aBkTkxapoJY" },
];

export interface RoomData {
  name: string;
  ownerId: string;
  djId?: string;
  djDisplayName?: string;
  playlist?: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
  currentTrackProgress?: number;
}


// This new component contains the hidden ReactPlayer and handles publishing its audio stream.
// It only renders for the DJ.
const JukeboxStreamer = ({ url, isPlaying, onEnded, onDuration }: { url: string, isPlaying: boolean, onEnded: () => void, onDuration: (duration: number) => void }) => {
    const playerRef = useRef<ReactPlayer>(null);
    const { localParticipant } = useLocalParticipant();

    useEffect(() => {
        if (!localParticipant) return;

        const publishJukeboxTrack = async () => {
            // This is a workaround to get an audio stream from ReactPlayer
            // It might not work in all browsers or if ReactPlayer changes its internal structure.
            // A more robust solution would involve server-side stream generation.
            const videoEl = document.createElement('video');
            videoEl.muted = true; // MUST be muted to be able to autoplay without user interaction
            
            const player = playerRef.current?.getInternalPlayer();
            if (player && player.src) {
                videoEl.src = player.src;
            }

            try {
                // @ts-ignore captureStream is present on HTMLMediaElement
                const stream = videoEl.captureStream() as MediaStream;
                const audioTrack = stream.getAudioTracks()[0];

                if (audioTrack) {
                    const trackPublication = await localParticipant.publishTrack(audioTrack, {
                        name: 'jukebox-audio',
                        source: LivekitClient.Track.Source.Unknown, // Using a custom source
                    });
                    return trackPublication;
                }
            } catch (e) {
                 console.error("Failed to capture and publish jukebox track:", e);
                 // Fallback or error handling
            }
        };

        let publication: LivekitClient.LocalTrackPublication | undefined;
        // The onReady prop can be unreliable, so we wait a moment.
        const timeoutId = setTimeout(() => {
             publishJukeboxTrack().then(pub => {
                publication = pub;
             });
        }, 1000);


        return () => {
            clearTimeout(timeoutId);
            if (publication) {
                localParticipant.unpublishTrack(publication.track);
            }
        };
    }, [localParticipant]);

    return (
        <div className="hidden">
            <ReactPlayer
                ref={playerRef}
                url={url}
                playing={isPlaying}
                onEnded={onEnded}
                onDuration={onDuration}
                // The player itself is muted on the DJ's side because we are capturing its stream
                // and hearing it back from LiveKit like every other user.
                muted={true}
                width="1px"
                height="1px"
                 config={{
                    youtube: {
                        playerVars: { controls: 0, disablekb: 1 }
                    }
                }}
            />
        </div>
    );
};


export default function UserList({ roomId }: { roomId: string }) {
  const [activePanels, setActivePanels] = useState({ playlist: true, add: false });
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const allParticipants = [
    ...(localParticipant ? [localParticipant] : []),
    ...remoteParticipants,
  ];

  // Find the music track from any participant in the room
  const musicTrackRefs = useTracks([LivekitClient.Track.Source.Unknown], {
    updateOnlyOn: [],
  });

  const jukeboxTrackRef = musicTrackRefs.find(ref => ref.publication.trackName === 'jukebox-audio');

  // User microphone and speaker state
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

  const [duration, setDuration] = useState(0);
  const [localProgress, setLocalProgress] = useState(0); // For DJ's remote control UI

  // Firestore state
  const roomRef = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return doc(firestore, 'rooms', roomId);
  }, [firestore, roomId]);

  const { data: room } = useDoc<RoomData>(roomRef);

  const isDj = user?.uid === room?.djId;
  const currentTrack = room?.playlist?.find(t => t.id === room?.currentTrackId);
  
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

  // Effect to load device preferences from local storage on mount
  useEffect(() => {
    try {
        const savedPanels = localStorage.getItem('hearmeout-active-panels');
        if (savedPanels) setActivePanels(JSON.parse(savedPanels));
    } catch (e) {
        console.error("Failed to load saved panel state from localStorage", e);
    }
  }, []);

  // Effect to set the initial speaker from local storage
  useEffect(() => {
      if (speakerDevices.length > 0) {
          const savedSpeakerId = localStorage.getItem('hearmeout-user-speaker-device-id');
          if (savedSpeakerId && speakerDevices.some(d => d.deviceId === savedSpeakerId)) {
              setSpeakerDevice(savedSpeakerId);
          }
      }
  }, [speakerDevices, setSpeakerDevice]);

  // Effect to set initial microphone from local storage
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


  useEffect(() => {
    if (room && !room.playlist && isDj && roomRef) {
        updateDocumentNonBlocking(roomRef, { 
            playlist: initialPlaylist,
            currentTrackId: initialPlaylist[0].id,
            isPlaying: true, // Start playing automatically
        });
    }
  }, [room, isDj, roomRef]);


  const handlePlaySong = (songId: string) => {
    if (!isDj || !roomRef) return;
    updateDocumentNonBlocking(roomRef, {
        currentTrackId: songId,
        isPlaying: true,
    });
  }

  const handlePlayPause = (playing: boolean) => {
    if (!isDj || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { isPlaying: playing });
  }

  const handlePlayNext = () => {
    if (!isDj || !roomRef || !room?.playlist || !room.currentTrackId) return;
    const currentIndex = room.playlist.findIndex(t => t.id === room.currentTrackId);
    if (currentIndex === -1) { 
        if (room.playlist.length > 0) handlePlaySong(room.playlist[0].id);
        return;
    }
    const nextIndex = (currentIndex + 1) % room.playlist.length;
    handlePlaySong(room.playlist[nextIndex].id);
  };

  const handlePlayPrev = () => {
     if (!isDj || !roomRef || !room?.playlist || !room.currentTrackId) return;
    const currentIndex = room.playlist.findIndex(t => t.id === room.currentTrackId);
    const prevIndex = (currentIndex - 1 + room.playlist.length) % room.playlist.length;
    handlePlaySong(room.playlist[prevIndex].id);
  };

  const handleAddItems = (newItems: PlaylistItem[]) => {
    if (!user || !roomRef || !room) return;
    const newPlaylist = [...(room.playlist || []), ...newItems];
    updateDocumentNonBlocking(roomRef, { playlist: newPlaylist });

    if (isDj && !room.isPlaying && (!room.playlist || room.playlist.length === 0)) {
       handlePlaySong(newItems[0].id);
    }
  };

  const handleTogglePanel = (panel: 'playlist' | 'add') => {
    setActivePanels(prev => {
        const newPanels = { ...prev, [panel]: !prev[panel] };
        try {
            localStorage.setItem('hearmeout-active-panels', JSON.stringify(newPanels));
        } catch (e) {
            console.error("Failed to save panel state to localStorage", e);
        }
        return newPanels;
    });
  }

  const handleRemoveSong = (songId: string) => {
    if (!isDj || !roomRef || !room?.playlist) return;
    const newPlaylist = room.playlist.filter(song => song.id !== songId);

    let updates: Partial<RoomData> & { currentTrackId?: any, currentTrackProgress?: any } = { playlist: newPlaylist };
    
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
    if (!isDj || !roomRef) return;
    updateDocumentNonBlocking(roomRef, { 
      playlist: [],
      currentTrackId: deleteField(),
      isPlaying: false,
    });
  };

  // Manual seek from the DJ's remote control. This is not used for continuous sync.
  const handleSeek = (seconds: number) => {
      // Seeking a live stream is complex. For now, this is a no-op.
      // In a more advanced implementation, this could send a command to the streamer.
  };

  return (
    <>
      {isDj && isClient && currentTrack && (
        <JukeboxStreamer 
            url={currentTrack.url}
            isPlaying={room?.isPlaying || false}
            onEnded={handlePlayNext}
            onDuration={setDuration}
        />
      )}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {isDj && (
              <div className="lg:col-span-1 h-full">
                <MusicPlayerCard
                  currentTrack={currentTrack}
                  progress={localProgress}
                  duration={duration}
                  playing={room?.isPlaying || false}
                  isPlayerControlAllowed={isDj}
                  onPlayPause={handlePlayPause}
                  onPlayNext={handlePlayNext}
                  onPlayPrev={handlePlayPrev}
                  onSeek={handleSeek}
                  activePanels={activePanels}
                  onTogglePanel={handleTogglePanel}
                />
              </div>
            )}
            
            <div className={isDj ? "lg:col-span-2" : "lg:col-span-3"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activePanels.playlist && (
                        <div className={activePanels.add ? "md:col-span-1" : "md:col-span-2"}>
                            <PlaylistPanel
                                playlist={room?.playlist || []}
                                onPlaySong={handlePlaySong}
                                currentTrackId={room?.currentTrackId || ""}
                                isPlayerControlAllowed={isDj}
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
                                canAddMusic={!!user}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {jukeboxTrackRef && (
            <MusicJukeboxCard 
              trackRef={jukeboxTrackRef}
              activePanels={activePanels}
              onTogglePanel={handleTogglePanel}
            />
          )}

          {allParticipants.map((participant) => {
              const isLocal = participant.sid === localParticipant?.sid;
              return (
                <UserCard
                  key={participant.sid}
                  participant={participant}
                  isLocal={isLocal}
                  isHost={participant.identity === room?.ownerId}
                  roomId={roomId}
                  micDevices={isLocal ? micDevices : undefined}
                  speakerDevices={isLocal ? speakerDevices : undefined}
                  activeMicId={isLocal ? activeMicId : ''}
                  activeSpeakerId={isLocal ? activeSpeakerId : ''}
                  onMicDeviceChange={isLocal ? handleMicDeviceChange : undefined}
                  onSpeakerDeviceChange={isLocal ? handleSpeakerDeviceChange : undefined}
                />
              )
            })
          }
        </div>
      </div>
    </>
  );
}

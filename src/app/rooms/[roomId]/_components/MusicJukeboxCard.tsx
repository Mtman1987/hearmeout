'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player/youtube';
import { Music, Volume2, VolumeX, ListMusic, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AudioVisualizer } from "./AudioVisualizer";
import { type PlaylistItem } from "./Playlist";
import { updateDocumentNonBlocking } from '@/firebase';
import { DocumentReference } from 'firebase/firestore';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface RoomData {
  name: string;
  ownerId: string;
  playlist?: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
  currentTrackProgress?: number;
}

interface MusicJukeboxCardProps {
  room: RoomData;
  isHost: boolean;
  roomRef: DocumentReference | null;
  setDuration: (duration: number) => void;
  activePanels: { playlist: boolean, add: boolean };
  onTogglePanel: (panel: 'playlist' | 'add') => void;
  onPlayNext: () => void;
}

export default function MusicJukeboxCard({ room, isHost, roomRef, setDuration, activePanels, onTogglePanel, onPlayNext }: MusicJukeboxCardProps) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const playerRef = useRef<ReactPlayer>(null);
  const lastProgressUpdateTime = useRef(0);

  const [volume, setVolume] = useState(0);
  const lastNonZeroVolume = useRef(0.5);

  useEffect(() => {
    if (volume > 0) {
      lastNonZeroVolume.current = volume;
    }
  }, [volume]);

  // Sync player to Firestore's progress, this keeps listeners in sync
  useEffect(() => {
    if (!isHost && playerRef.current && typeof room.currentTrackProgress === 'number') {
      const localProgress = playerRef.current.getCurrentTime();
      // Only seek if the difference is significant, to avoid jumpiness
      if (Math.abs(localProgress - room.currentTrackProgress) > 5) {
        playerRef.current.seekTo(room.currentTrackProgress, 'seconds');
      }
    }
  }, [room.currentTrackProgress, isHost]);

  // The Host is the timekeeper for the room
  const handleProgress = (state: { playedSeconds: number }) => {
    if (isHost && roomRef) {
        const now = Date.now();
        // Throttle updates to every 2 seconds to avoid excessive writes
        if (now - lastProgressUpdateTime.current > 2000) {
            lastProgressUpdateTime.current = now;
            updateDocumentNonBlocking(roomRef, { currentTrackProgress: state.playedSeconds });
        }
    }
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
    if (isHost && roomRef) {
        // When a new track loads, reset progress for all clients.
        updateDocumentNonBlocking(roomRef, { currentTrackProgress: 0 });
    }
  };

  const handleEnded = () => {
    if (isHost) {
      onPlayNext();
    }
  };
  
  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const toggleMute = () => {
    setVolume(prevVolume => (prevVolume > 0 ? 0 : lastNonZeroVolume.current));
  };

  const isMuted = volume === 0;
  const isAudioPlayingForMe = !!room.isPlaying && !isMuted;
  const currentTrack = room.playlist?.find(t => t.id === room.currentTrackId);

  return (
    <>
      <div className="hidden">
        {isClient && currentTrack && (
          <ReactPlayer
            ref={playerRef}
            url={currentTrack.url}
            playing={room.isPlaying}
            volume={volume}
            onDuration={handleDuration}
            onProgress={handleProgress}
            onEnded={handleEnded}
            progressInterval={1000}
            width="1px"
            height="1px"
            config={{
              youtube: {
                playerVars: { controls: 0, disablekb: 1 }
              }
            }}
          />
        )}
      </div>

      <Card className="flex flex-col h-full">
        <CardContent className="p-4 flex flex-col gap-4 flex-grow">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className={cn("h-16 w-16 transition-all", room.isPlaying && "ring-4 ring-primary ring-offset-2 ring-offset-card")}>
                <AvatarFallback>
                  <Music className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg truncate">Jukebox</p>
              <p className="text-sm text-muted-foreground">Now Playing</p>
            </div>
          </div>
          <div className="space-y-2 flex-grow flex flex-col justify-end">
            <div className="flex items-center gap-2 justify-end">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant={activePanels.playlist ? "secondary" : "ghost"} size="icon" onClick={() => onTogglePanel('playlist')} aria-label="Toggle Playlist" className="h-8 w-8">
                            <ListMusic className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>Up Next</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant={activePanels.add ? "secondary" : "ghost"} size="icon" onClick={() => onTogglePanel('add')} aria-label="Add Music" className="h-8 w-8">
                            <Youtube className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>Add Music</p>
                    </TooltipContent>
                </Tooltip>
            </div>
             <div className="h-8 flex items-end">
                <AudioVisualizer isSpeaking={isAudioPlayingForMe} />
             </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <Slider
                aria-label="Volume"
                value={[volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.05}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

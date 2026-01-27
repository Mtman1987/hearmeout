'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player/youtube';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AudioVisualizer } from "./AudioVisualizer";
import { type PlaylistItem } from "./Playlist";

interface RoomData {
  name: string;
  ownerId: string;
  playlist?: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
  currentTrackProgress?: number;
}

export default function MusicJukeboxCard({ room }: { room: RoomData }) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const playerRef = useRef<ReactPlayer>(null);
  const [duration, setDuration] = useState(0);

  // Local state for this user's volume preference for the jukebox
  const [localVolume, setLocalVolume] = useState(1);
  const [isLocallyMuted, setIsLocallyMuted] = useState(false);

  // Sync player to Firestore's progress
  useEffect(() => {
    if (playerRef.current && room.currentTrackProgress) {
      const localProgress = playerRef.current.getCurrentTime();
      if (Math.abs(localProgress - room.currentTrackProgress) > 3) {
        playerRef.current.seekTo(room.currentTrackProgress, 'seconds');
      }
    }
  }, [room.currentTrackProgress]);

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setLocalVolume(newVolume);
    if (newVolume > 0 && isLocallyMuted) {
      setIsLocallyMuted(false);
    }
  };

  const isAudioPlayingForMe = !!room.isPlaying && !isLocallyMuted && localVolume > 0;
  const currentTrack = room.playlist?.find(t => t.id === room.currentTrackId);

  return (
    <>
      <div className="hidden">
        {isClient && currentTrack && (
          <ReactPlayer
            ref={playerRef}
            url={currentTrack.url}
            playing={room.isPlaying}
            volume={localVolume}
            muted={isLocallyMuted}
            onDuration={setDuration}
            width="1px"
            height="1px"
            progressInterval={1000}
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
             <AudioVisualizer isSpeaking={isAudioPlayingForMe} />
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsLocallyMuted(!isLocallyMuted)}
                aria-label={isLocallyMuted ? "Unmute" : "Mute"}
              >
                {isLocallyMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <Slider
                aria-label="Volume"
                value={[isLocallyMuted ? 0 : localVolume]}
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

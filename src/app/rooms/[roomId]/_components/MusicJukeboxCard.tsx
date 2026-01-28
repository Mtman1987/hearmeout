'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Music, Volume2, VolumeX, ListMusic, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AudioVisualizer } from "./AudioVisualizer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AudioTrack, useTrackVolume } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';


interface MusicJukeboxCardProps {
  trackRef: TrackReference | undefined;
  activePanels: { playlist: boolean, add: boolean };
  onTogglePanel: (panel: 'playlist' | 'add') => void;
}

export default function MusicJukeboxCard({ trackRef, activePanels, onTogglePanel }: MusicJukeboxCardProps) {
  const [volume, setVolume] = useState(0.5);
  const { volume: trackVolume, isMuted: isTrackMuted } = useTrackVolume(trackRef);
  const lastNonZeroVolume = useRef(0.5);

  useEffect(() => {
    if (volume > 0) {
      lastNonZeroVolume.current = volume;
    }
  }, [volume]);
  
  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const toggleMute = () => {
    setVolume(prevVolume => (prevVolume > 0 ? 0 : lastNonZeroVolume.current));
  };

  const isMutedByMe = volume === 0;
  const isAudioPlayingForMe = !!trackRef && !isMutedByMe && !isTrackMuted;
  
  const audioLevel = trackRef?.participant.audioLevel ?? 0;

  return (
    <>
      {trackRef && <AudioTrack trackRef={trackRef} volume={volume} />}
      <Card className="flex flex-col h-full">
        <CardContent className="p-4 flex flex-col gap-4 flex-grow">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className={cn("h-16 w-16 transition-all", isAudioPlayingForMe && "ring-4 ring-primary ring-offset-2 ring-offset-card")}>
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
                <AudioVisualizer isSpeaking={isAudioPlayingForMe && audioLevel > 0.05} />
             </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={toggleMute}
                aria-label={isMutedByMe ? "Unmute" : "Mute"}
              >
                {isMutedByMe ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
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

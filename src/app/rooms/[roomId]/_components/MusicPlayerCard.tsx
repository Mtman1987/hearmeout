'use client';

import Image from "next/image";
import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Youtube,
  Music,
  ListMusic,
} from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";
import { type PlaylistItem } from "./Playlist";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MusicPlayerCardProps = {
  currentTrack: PlaylistItem | undefined;
  progress: number;
  duration: number;
  playing: boolean;
  isPlayerControlAllowed: boolean;
  onPlayPause: (playing: boolean) => void;
  onPlayNext: () => void;
  onPlayPrev: () => void;
  onSeek: (seconds: number) => void;
  activePanels: { playlist: boolean, add: boolean };
  onTogglePanel: (panel: 'playlist' | 'add') => void;
};

// This component is now a "Remote Control" for the host. It only sends commands.
// The actual audio playback is handled by MusicJukeboxCard via a WebRTC stream.
export default function MusicPlayerCard({
  currentTrack,
  progress,
  duration,
  playing,
  isPlayerControlAllowed,
  onPlayPause,
  onPlayNext,
  onPlayPrev,
  onSeek,
  activePanels,
  onTogglePanel,
}: MusicPlayerCardProps) {

  const [isSeeking, setIsSeeking] = React.useState(false);
  const [seekValue, setSeekValue] = React.useState(progress);

  React.useEffect(() => {
    if (!isSeeking) {
      setSeekValue(progress);
    }
  }, [progress, isSeeking]);

  const albumArt = currentTrack ? placeholderData.placeholderImages.find(p => p.id === currentTrack.artId) : undefined;

  const handlePlayPause = () => isPlayerControlAllowed && currentTrack && onPlayPause(!playing);
  const handlePlayNextWithTrack = () => isPlayerControlAllowed && currentTrack && onPlayNext();
  const handlePlayPrevWithTrack = () => isPlayerControlAllowed && currentTrack && onPlayPrev();
  
  const handleSeekChange = (value: number[]) => {
    if (!isSeeking) setIsSeeking(true);
    setSeekValue(value[0]);
  }
  
  const handleSeekCommit = (value: number[]) => {
    if (isPlayerControlAllowed) {
        onSeek(value[0]);
    }
    setIsSeeking(false);
  }
  
  const formatTime = (seconds: number) => {
    const floorSeconds = Math.floor(seconds);
    const min = Math.floor(floorSeconds / 60);
    const sec = floorSeconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0">
              {albumArt ? (
                  <Image
                      src={albumArt.imageUrl}
                      alt={currentTrack?.title || "Album Art"}
                      fill
                      sizes="64px"
                      className="rounded-lg shadow-lg object-cover"
                      data-ai-hint={albumArt.imageHint}
                  />
              ) : (
                  <div className="w-full h-full rounded-lg shadow-lg bg-muted flex items-center justify-center">
                      <Music className="w-8 h-8 text-muted-foreground" />
                  </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
                <CardTitle className="font-headline text-lg flex items-center gap-2">
                    <Music /> Now Playing
                </CardTitle>
                <p className="text-muted-foreground text-sm truncate">{currentTrack ? `${currentTrack.title} - ${currentTrack.artist}` : "No song selected"}</p>
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <div className="flex items-center gap-2 ml-auto">
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Button variant={activePanels.playlist ? "secondary" : "ghost"} size="icon" onClick={() => onTogglePanel('playlist')} aria-label="Toggle Playlist" className="h-8 w-8">
                          <ListMusic className="h-4 w-4" />
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Up Next</p>
                  </TooltipContent>
              </Tooltip>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Button variant={activePanels.add ? "secondary" : "ghost"} size="icon" onClick={() => onTogglePanel('add')} aria-label="Add Music" className="h-8 w-8">
                          <Youtube className="h-4 w-4" />
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Add Music</p>
                  </TooltipContent>
              </Tooltip>
          </div>
        </div>

        <div className="pt-2">
            <Slider
                value={[seekValue]}
                onValueChange={handleSeekChange}
                onValueCommit={handleSeekCommit}
                max={duration > 0 ? duration : 1}
                step={1}
                disabled={!isPlayerControlAllowed || !currentTrack}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{formatTime(seekValue)}</span>
                <span>{formatTime(duration)}</span>
            </div>
        </div>
       
        <div className="flex items-center justify-center gap-1">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handlePlayPrevWithTrack} disabled={!isPlayerControlAllowed || !currentTrack}>
                      <SkipBack />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Previous</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button size="lg" className="h-12 w-12 rounded-full" onClick={handlePlayPause} disabled={!isPlayerControlAllowed || !currentTrack}>
                      {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{playing ? 'Pause' : 'Play'}</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handlePlayNextWithTrack} disabled={!isPlayerControlAllowed || !currentTrack}>
                      <SkipForward/>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Next</p>
                </TooltipContent>
            </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

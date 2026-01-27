'use client';

import Image from "next/image";
import React, { useState, useRef, useEffect, forwardRef } from "react";
import ReactPlayer from "react-player/youtube";
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
  Volume2,
  VolumeX,
  Youtube,
  Music,
  ListMusic,
} from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";
import { type PlaylistItem } from "./Playlist";
import { AudioVisualizer } from "./AudioVisualizer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";


const MusicPlayerCard = forwardRef<ReactPlayer, {
  roomId: string;
  currentTrack: PlaylistItem | undefined;
  playlist: PlaylistItem[];
  playing: boolean;
  isPlayerControlAllowed: boolean;
  onPlayPause: (playing: boolean) => void;
  onPlayNext: () => void;
  onPlayPrev: () => void;
  activePanels: { playlist: boolean, add: boolean };
  onTogglePanel: (panel: 'playlist' | 'add') => void;
  isRoomOwner: boolean;
  progress: number; // Progress in seconds
  onSeek: (seconds: number) => void;
}>(({
  roomId,
  currentTrack,
  playlist,
  playing,
  isPlayerControlAllowed,
  onPlayPause,
  onPlayNext,
  onPlayPrev,
  activePanels,
  onTogglePanel,
  isRoomOwner,
  progress,
  onSeek,
}, ref) => {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const internalPlayerRef = useRef<ReactPlayer | null>(null);
  const [duration, setDuration] = useState(0);

  // This allows the parent to control the player while also having an internal ref
  React.useImperativeHandle(ref, () => internalPlayerRef.current!, []);

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(progress);

  // State for local volume. THIS IS THE KEY CHANGE.
  const [localVolume, setLocalVolume] = useState(1);
  const [isLocallyMuted, setIsLocallyMuted] = useState(false);

  useEffect(() => {
    if (!isSeeking) {
      setSeekValue(progress);
    }
  }, [progress, isSeeking]);
  
  // Load local volume from localStorage on mount
  useEffect(() => {
    if (!isClient) return;
    try {
        const savedVolume = localStorage.getItem(`hearmeout-listener-volume-${roomId}`);
        if (savedVolume !== null) {
            const parsed = JSON.parse(savedVolume);
            setLocalVolume(parsed.volume);
            setIsLocallyMuted(parsed.isMuted);
        }
    } catch (e) {
        console.error("Failed to load local music volume from localStorage", e);
    }
  }, [roomId, isClient]);

  // Save local volume to localStorage on change
  useEffect(() => {
    if (!isClient) return;
    try {
        const value = { volume: localVolume, isMuted: isLocallyMuted };
        localStorage.setItem(`hearmeout-listener-volume-${roomId}`, JSON.stringify(value));
    } catch (e) {
        console.error("Failed to save local music volume to localStorage", e);
    }
  }, [localVolume, isLocallyMuted, roomId, isClient]);


  const albumArt = currentTrack ? placeholderData.placeholderImages.find(p => p.id === currentTrack.artId) : undefined;

  const handlePlayPause = () => isPlayerControlAllowed && currentTrack && onPlayPause(!playing);
  const handlePlayNextWithTrack = () => isPlayerControlAllowed && currentTrack && onPlayNext();
  const handlePlayPrevWithTrack = () => isPlayerControlAllowed && currentTrack && onPlayPrev();
  
  const handleLocalVolumeChange = (value: number[]) => {
      setLocalVolume(value[0]);
      if (value[0] > 0 && isLocallyMuted) {
          setIsLocallyMuted(false);
      }
  }

  const handleSeekChange = (value: number[]) => {
    if (!isSeeking) setIsSeeking(true);
    setSeekValue(value[0]);
  }
  
  const handleSeekCommit = (value: number[]) => {
    // only host can seek for everyone
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

  const isAudioPlayingForMe = !!currentTrack && playing && !isLocallyMuted;

  return (
    <Card className="flex flex-col h-full">
       <div className="hidden">
        {/* Everyone now gets a ReactPlayer. Volume and mute are controlled locally. */}
        {isClient && currentTrack && (
            <ReactPlayer
                ref={internalPlayerRef}
                url={currentTrack.url}
                playing={playing}
                volume={localVolume}
                muted={isLocallyMuted}
                onDuration={setDuration}
                onEnded={onPlayNext}
                onPause={() => onPlayPause(false)}
                onPlay={() => onPlayPause(true)}
                width="1px"
                height="1px"
                progressInterval={1000}
                config={{
                    youtube: {
                        playerVars: {
                            // Attempts to disable controls on the embedded YouTube player
                            controls: 0,
                            disablekb: 1,
                        }
                    }
                }}
            />
        )}
      </div>
      <CardHeader>
        <div className="flex items-center gap-4">
            {albumArt ? (
                <Image
                    src={albumArt.imageUrl}
                    alt={currentTrack?.title || "Album Art"}
                    width={64}
                    height={64}
                    className="rounded-lg shadow-lg object-cover aspect-square"
                    data-ai-hint={albumArt.imageHint}
                />
            ) : (
                <div className="w-16 h-16 rounded-lg shadow-lg bg-muted flex items-center justify-center">
                    <Music className="w-8 h-8 text-muted-foreground" />
                </div>
            )}
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
          <AudioVisualizer isSpeaking={isAudioPlayingForMe} />
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
                max={duration}
                step={1}
                disabled={!isPlayerControlAllowed || !currentTrack}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{formatTime(seekValue)}</span>
                <span>{formatTime(duration)}</span>
            </div>
        </div>
       
        <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center justify-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handlePlayPrevWithTrack} disabled={!isPlayerControlAllowed || !currentTrack} className="h-9 w-9">
                          <SkipBack className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Previous</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="default" className="h-10 w-10 rounded-full" onClick={handlePlayPause} disabled={!isPlayerControlAllowed || !currentTrack}>
                          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{playing ? 'Pause' : 'Play'}</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handlePlayNextWithTrack} disabled={!isPlayerControlAllowed || !currentTrack} className="h-9 w-9">
                          <SkipForward className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Next</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            {/* THIS IS NOW THE LOCAL VOLUME CONTROL FOR EVERYONE */}
            <div className="flex items-center gap-2 flex-1 min-w-24">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setIsLocallyMuted(!isLocallyMuted)} className="h-9 w-9">
                            {isLocallyMuted ? <VolumeX className="h-5 w-5 text-muted-foreground" /> : <Volume2 className="h-5 w-5 text-muted-foreground" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{isLocallyMuted ? 'Unmute' : 'Mute'}</p>
                    </TooltipContent>
                </Tooltip>
                <Slider 
                    value={[isLocallyMuted ? 0 : localVolume]} 
                    onValueChange={handleLocalVolumeChange}
                    max={1}
                    step={0.05}
                />
            </div>
        </div>
      </CardContent>
    </Card>
  );
});

MusicPlayerCard.displayName = "MusicPlayerCard";

export default MusicPlayerCard;

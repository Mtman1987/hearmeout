'use client';

import Image from "next/image";
import React, { useState, useRef, useEffect } from "react";
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


export default function MusicPlayerCard({
  roomId,
  currentTrack,
  playlist,
  playing,
  isPlayerControlAllowed,
  onPlayPause,
  onPlayNext,
  onPlayPrev,
  onSeek,
  activePanels,
  onTogglePanel,
}: {
  roomId: string;
  currentTrack: PlaylistItem | undefined;
  playlist: PlaylistItem[];
  playing: boolean;
  isPlayerControlAllowed: boolean;
  onPlayPause: (playing: boolean) => void;
  onPlayNext: () => void;
  onPlayPrev: () => void;
  onSeek: (played: number) => void;
  activePanels: { playlist: boolean, add: boolean };
  onTogglePanel: (panel: 'playlist' | 'add') => void;
}) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  
  const playerRef = useRef<ReactPlayer>(null);

  // Load volume from localStorage on mount
  useEffect(() => {
    if (!isClient) return;
    try {
        const savedVolume = localStorage.getItem(`hearmeout-music-volume-${roomId}`);
        if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) {
            setVolume(parseFloat(savedVolume));
        }
    } catch (e) {
        console.error("Failed to load music volume from localStorage", e);
    }
  }, [roomId, isClient]);

  // Save volume to localStorage on change
  useEffect(() => {
    if (!isClient) return;
    try {
        localStorage.setItem(`hearmeout-music-volume-${roomId}`, String(volume));
    } catch (e) {
        console.error("Failed to save music volume to localStorage", e);
    }
  }, [volume, roomId, isClient]);

  useEffect(() => {
    if (currentTrack) {
        setPlayed(0); // Reset progress when track changes
    } else {
        setPlayed(0);
        setDuration(0);
    }
  }, [currentTrack]);
  
  useEffect(() => {
    // If user cannot control player, just listen for changes
    if (!isPlayerControlAllowed && playerRef.current) {
        playerRef.current.seekTo(played);
    }
  }, [played, isPlayerControlAllowed]);


  const albumArt = currentTrack ? placeholderData.placeholderImages.find(p => p.id === currentTrack.artId) : undefined;

  const handlePlayPause = () => isPlayerControlAllowed && currentTrack && onPlayPause(!playing);
  const handlePlayNextWithTrack = () => isPlayerControlAllowed && currentTrack && onPlayNext();
  const handlePlayPrevWithTrack = () => isPlayerControlAllowed && currentTrack && onPlayPrev();
  
  const handleVolumeChange = (value: number[]) => {
      setVolume(value[0]);
      if (value[0] > 0 && isMuted) {
          setIsMuted(false);
      }
  }
  
  const handleProgress = (state: { played: number }) => {
    if (!seeking) {
      setPlayed(state.played);
      // Player controller broadcasts progress
      if(isPlayerControlAllowed) onSeek(state.played);
    }
  };

  const handleDuration = (duration: number) => setDuration(duration);
  const handleSeekChange = (value: number[]) => { 
    if (!isPlayerControlAllowed || !currentTrack) return;
    setPlayed(value[0]); 
  };
  const handleSeekCommit = (value: number[]) => {
    if (!isPlayerControlAllowed || !currentTrack) return;
    setSeeking(false);
    playerRef.current?.seekTo(value[0]);
    onSeek(value[0]);
  };
  
  function formatTime(seconds: number) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const date = new Date(seconds * 1000);
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString();
    const hh = Math.floor(seconds / 3600);
    if (hh > 0) {
      return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
    }
    return `${mm}:${ss}`;
  }

  const playedSeconds = duration * played;

  return (
    <Card className="flex flex-col h-full">
       <div className="hidden">
      {isClient && currentTrack && (
            <ReactPlayer
                ref={playerRef}
                url={currentTrack.url}
                playing={playing}
                muted={isMuted}
                volume={volume}
                onProgress={handleProgress}
                onDuration={handleDuration}
                onEnded={onPlayNext}
                onPause={() => isPlayerControlAllowed && onPlayPause(false)}
                onPlay={() => isPlayerControlAllowed && onPlayPause(true)}
                width="1px"
                height="1px"
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
          <AudioVisualizer isSpeaking={!!currentTrack && playing && !isMuted} />
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
        <div className="space-y-1">
            <Slider 
              value={[played]}
              onValueChange={handleSeekChange}
              onValueCommit={handleSeekCommit}
              onPointerDown={() => isPlayerControlAllowed && currentTrack && setSeeking(true)}
              max={1} 
              step={0.01}
              disabled={!isPlayerControlAllowed || !currentTrack}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(playedSeconds)}</span>
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
            <div className="flex items-center gap-2 flex-1 min-w-24">
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)} className="h-9 w-9">
                            {isMuted ? <VolumeX className="h-5 w-5 text-muted-foreground" /> : <Volume2 className="h-5 w-5 text-muted-foreground" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{isMuted ? 'Unmute' : 'Mute'}</p>
                    </TooltipContent>
                </Tooltip>
                <Slider 
                    value={[isMuted ? 0 : volume]} 
                    onValueChange={handleVolumeChange}
                    max={1}
                    step={0.05}
                />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

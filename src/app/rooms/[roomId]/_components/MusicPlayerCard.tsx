'use client';

import Image from "next/image";
import React, { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player/youtube";
import {
  Card,
  CardContent,
  CardFooter,
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
  Youtube,
  Music,
  ListMusic,
} from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";
import { type PlaylistItem } from "./Playlist";
import { AudioVisualizer } from "./AudioVisualizer";


export default function MusicPlayerCard({
  currentTrack,
  playing,
  setPlaying,
  onPlayNext,
  onPlayPrev,
  activePanels,
  onTogglePanel,
}: {
  currentTrack: PlaylistItem;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  onPlayNext: () => void;
  onPlayPrev: () => void;
  activePanels: { playlist: boolean, add: boolean };
  onTogglePanel: (panel: 'playlist' | 'add') => void;
}) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const [volume, setVolume] = useState(0.5);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  
  const playerRef = useRef<ReactPlayer>(null);

  useEffect(() => {
    setPlayed(0);
  }, [currentTrack]);


  const albumArt = placeholderData.placeholderImages.find(p => p.id === currentTrack.artId);

  const handlePlayPause = () => setPlaying(!playing);
  const handleVolumeChange = (value: number[]) => setVolume(value[0]);
  
  const handleProgress = (state: { played: number }) => {
    if (!seeking) {
      setPlayed(state.played);
    }
  };

  const handleDuration = (duration: number) => setDuration(duration);
  const handleSeekChange = (value: number[]) => { setPlayed(value[0]); };
  const handleSeekCommit = (value: number[]) => {
    setSeeking(false);
    playerRef.current?.seekTo(value[0]);
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
    <Card className="flex flex-col">
       <div className="hidden">
      {isClient && currentTrack && (
            <ReactPlayer
                ref={playerRef}
                url={currentTrack.url}
                playing={playing}
                volume={volume}
                onProgress={handleProgress}
                onDuration={handleDuration}
                onEnded={onPlayNext}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                width="1px"
                height="1px"
            />
      )}
      </div>
      <CardHeader>
        <div className="flex items-center gap-4">
            {albumArt &&
                <Image
                    src={albumArt.imageUrl}
                    alt={currentTrack?.title || "Album Art"}
                    width={64}
                    height={64}
                    className="rounded-lg shadow-lg object-cover aspect-square"
                    data-ai-hint={albumArt.imageHint}
                />
            }
            <div className="flex-1 overflow-hidden">
                <CardTitle className="font-headline text-lg flex items-center gap-2">
                    <Music /> Now Playing
                </CardTitle>
                <p className="text-muted-foreground text-sm truncate">{currentTrack?.title || "..."} - {currentTrack?.artist || "..."}</p>
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end gap-4">
        <AudioVisualizer isSpeaking={playing} />
        <div className="space-y-2">
            <Slider 
              value={[played]} 
              onValueChange={handleSeekChange}
              onValueCommit={handleSeekCommit}
              onPointerDown={() => setSeeking(true)}
              max={1} 
              step={0.01} 
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(playedSeconds)}</span>
              <span>{formatTime(duration)}</span>
            </div>
        </div>
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center justify-center gap-2">
                <Button variant="ghost" size="icon" onClick={onPlayPrev}>
                  <SkipBack />
                </Button>
                <Button size="lg" className="h-12 w-12 rounded-full" onClick={handlePlayPause}>
                  {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={onPlayNext}>
                  <SkipForward />
                </Button>
            </div>
            <div className="flex items-center gap-2 w-24">
                <Volume2 className="text-muted-foreground" />
                <Slider 
                    value={[volume]} 
                    onValueChange={handleVolumeChange}
                    max={1}
                    step={0.05}
                />
            </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <div className="flex items-center justify-center w-full gap-2">
            <Button variant={activePanels.playlist ? "secondary" : "ghost"} size="icon" onClick={() => onTogglePanel('playlist')} aria-label="Toggle Playlist">
                <ListMusic className="h-5 w-5" />
            </Button>
            <Button variant={activePanels.add ? "secondary" : "ghost"} size="icon" onClick={() => onTogglePanel('add')} aria-label="Add Music">
                <Youtube className="h-5 w-5" />
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

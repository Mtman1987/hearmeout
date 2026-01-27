'use client';

import Image from "next/image";
import React, { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player/youtube";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Youtube,
  Upload,
} from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";

export default function MusicPlayer() {
  const albumArt = placeholderData.placeholderImages.find(p => p.id === "album-art-1");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const [url, setUrl] = useState("https://www.youtube.com/watch?v=c9scA_s1d4A");
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [song, setSong] = useState({ title: "Golden Hour", artist: "JVKE"});
  
  const [inputValue, setInputValue] = useState("");
  const playerRef = useRef<ReactPlayer>(null);

  const handlePlayPause = () => setPlaying(!playing);
  const handleVolumeChange = (value: number[]) => setVolume(value[0]);
  
  const handleProgress = (state: { played: number }) => {
    if (!seeking) {
      setPlayed(state.played);
    }
  };

  const handleDuration = (duration: number) => setDuration(duration);

  const handleSeekChange = (value: number[]) => {
    setPlayed(value[0]);
  };
  
  const handleSeekCommit = (value: number[]) => {
    setSeeking(false);
    playerRef.current?.seekTo(value[0]);
  };
  
  const handleAddUrl = () => {
    if (inputValue.trim() && isClient && ReactPlayer.canPlay(inputValue)) {
      setUrl(inputValue);
      setPlayed(0);
      setPlaying(true);
      setSong({title: "YouTube Video", artist: "from URL"});
      setInputValue("");
    }
  };

  const handleSeekForward = () => {
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    playerRef.current?.seekTo(currentTime + 10);
  };
  
  const handleSeekBackward = () => {
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    playerRef.current?.seekTo(currentTime - 10);
  };

  function formatTime(seconds: number) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const date = new Date(seconds * 1000);
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const hh = Math.floor(seconds / 3600);
    if (hh > 0) {
      return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
    }
    return `${mm}:${ss}`;
  }

  const playedSeconds = duration * played;

  return (
    <Card className="overflow-hidden">
      <div className="hidden">
      {isClient && (
            <ReactPlayer
                ref={playerRef}
                url={url}
                playing={playing}
                volume={volume}
                onProgress={handleProgress}
                onDuration={handleDuration}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                width="1px"
                height="1px"
            />
      )}
      </div>
      <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-center">
        {albumArt &&
            <Image
                src={albumArt.imageUrl}
                alt="Album Art"
                width={150}
                height={150}
                className="rounded-lg shadow-lg object-cover aspect-square"
                data-ai-hint={albumArt.imageHint}
            />
        }
        <div className="flex-1 w-full">
          <div className="text-center sm:text-left">
            <h3 className="text-2xl font-bold font-headline">{song.title}</h3>
            <p className="text-muted-foreground">{song.artist}</p>
          </div>
          <div className="mt-4 space-y-2">
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
          <div className="mt-4 flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleSeekBackward}>
              <SkipBack />
            </Button>
            <Button size="lg" className="h-14 w-14 rounded-full" onClick={handlePlayPause}>
              {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSeekForward}>
              <SkipForward />
            </Button>
          </div>
        </div>
        <div className="flex sm:flex-col items-center justify-center gap-2">
            <Volume2 className="text-muted-foreground" />
            <Slider 
                orientation="vertical" 
                value={[volume]} 
                onValueChange={handleVolumeChange}
                max={1}
                step={0.05}
                className="h-24 w-2 sm:h-24 sm:w-auto"
            />
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 p-4 flex gap-2">
        <div className="relative flex-grow">
            <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Add YouTube URL" 
              className="pl-10"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddUrl();
                }
              }}
            />
        </div>
        <Button variant="outline" onClick={handleAddUrl}>Add</Button>
        <Button variant="outline" size="icon">
            <Upload className="h-5 w-5" />
            <span className="sr-only">Upload Audio</span>
        </Button>
      </CardFooter>
    </Card>
  );
}

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
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Youtube,
  Upload,
  Music,
  ListMusic
} from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";
import Playlist from "./Playlist";

export default function MusicPlayerCard() {
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
    <Card className="flex flex-col">
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
      <CardHeader>
        <div className="flex items-center gap-4">
            {albumArt &&
                <Image
                    src={albumArt.imageUrl}
                    alt="Album Art"
                    width={64}
                    height={64}
                    className="rounded-lg shadow-lg object-cover aspect-square"
                    data-ai-hint={albumArt.imageHint}
                />
            }
            <div className="flex-1">
                <CardTitle className="font-headline text-lg flex items-center gap-2">
                    <Music /> Now Playing
                </CardTitle>
                <p className="text-muted-foreground text-sm truncate">{song.title} - {song.artist}</p>
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end gap-4">
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
                <Button variant="ghost" size="icon" onClick={handleSeekBackward}>
                  <SkipBack />
                </Button>
                <Button size="lg" className="h-12 w-12 rounded-full" onClick={handlePlayPause}>
                  {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSeekForward}>
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
      <CardFooter className="p-0 border-t">
          <Accordion type="single" collapsible className="w-full" defaultValue="playlist">
            <AccordionItem value="playlist">
              <AccordionTrigger className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <ListMusic className="h-5 w-5" />
                  Up Next
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                 <Playlist />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="add-music" className="border-b-0">
              <AccordionTrigger className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Youtube className="h-5 w-5" />
                  Add Music
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pt-2 pb-4">
                <div className="flex gap-2">
                    <div className="relative flex-grow">
                        <Input 
                          placeholder="Add YouTube URL" 
                          className="pl-4"
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
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
      </CardFooter>
    </Card>
  );
}

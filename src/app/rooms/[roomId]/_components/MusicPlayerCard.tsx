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
import Playlist, { type PlaylistItem } from "./Playlist";


const initialPlaylist: PlaylistItem[] = [
  { id: 1, title: "Golden Hour", artist: "JVKE", artId: "album-art-1", url: "https://www.youtube.com/watch?v=c9scA_s1d4A" },
  { id: 2, title: "Sofia", artist: "Clairo", artId: "album-art-2", url: "https://www.youtube.com/watch?v=L9l8zCOwEII" },
  { id: 3, title: "Sweden", artist: "C418", artId: "album-art-3", url: "https://www.youtube.com/watch?v=aBkTkxapoJY" },
  { id: 4, title: "Don't Stop The Music", artist: "Rihanna", artId: "album-art-1", url: "https://www.youtube.com/watch?v=yd8jh9QYfSM" },
  { id: 5, title: "So What", artist: "Miles Davis", artId: "album-art-2", url: "https://www.youtube.com/watch?v=ylXk1LBvIqU" },
];


export default function MusicPlayerCard() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const [playlist, setPlaylist] = useState<PlaylistItem[]>(initialPlaylist);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  const currentTrack = playlist[currentTrackIndex] || initialPlaylist[0];
  
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  
  const [inputValue, setInputValue] = useState("");
  const playerRef = useRef<ReactPlayer>(null);

  const albumArt = placeholderData.placeholderImages.find(p => p.id === currentTrack.artId);

  const playSong = (index: number) => {
    setCurrentTrackIndex(index);
    setPlayed(0);
    setPlaying(true);
  }

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
  
  const handleAddUrl = () => {
    if (inputValue.trim() && isClient && ReactPlayer.canPlay(inputValue)) {
      const newSong: PlaylistItem = {
        id: Date.now(),
        title: "YouTube Video",
        artist: "From URL",
        artId: "album-art-1",
        url: inputValue,
      };
      
      const newPlaylist = [newSong, ...playlist];
      setPlaylist(newPlaylist);
      playSong(0);
      setInputValue("");
    }
  };

  const handlePlayNext = () => {
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    playSong(nextIndex);
  };
  
  const handlePlayPrev = () => {
    const prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    playSong(prevIndex);
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
                url={currentTrack.url}
                playing={playing}
                volume={volume}
                onProgress={handleProgress}
                onDuration={handleDuration}
                onEnded={handlePlayNext}
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
                    alt={currentTrack.title}
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
                <p className="text-muted-foreground text-sm truncate">{currentTrack.title} - {currentTrack.artist}</p>
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
                <Button variant="ghost" size="icon" onClick={handlePlayPrev}>
                  <SkipBack />
                </Button>
                <Button size="lg" className="h-12 w-12 rounded-full" onClick={handlePlayPause}>
                  {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handlePlayNext}>
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
                 <Playlist playlist={playlist} onPlaySong={playSong} currentTrackId={currentTrack.id} />
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

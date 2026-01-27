'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, MicOff, Mic } from "lucide-react";
import { SpeakingIndicator } from "./SpeakingIndicator";
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AudioTrack, useTracks } from '@livekit/components-react';
import type { Participant, TrackPublication } from 'livekit-client';
import { Track } from 'livekit-client';
import { useState, useEffect } from 'react';


export default function UserCard({
    participant,
}: {
    participant: Participant;
}) {
  const [volume, setVolume] = useState(1);
  const [isMutedForUser, setIsMutedForUser] = useState(false);
  
  const { isLocal, isMicrophoneMuted, isSpeaking, metadata, name, identity } = participant;

  const tracks = useTracks(
    [Track.Source.Microphone],
    { participant }
  );

  const getParticipantPhotoURL = (meta: string | undefined): string => {
    if (!meta || meta.trim() === '') return `https://picsum.photos/seed/${identity}/100/100`;
    try {
      const parsed = JSON.parse(meta);
      return parsed.photoURL || `https://picsum.photos/seed/${identity}/100/100`;
    } catch (e) {
      console.error('Failed to parse participant metadata:', e);
      return `https://picsum.photos/seed/${identity}/100/100`;
    }
  };

  const photoURL = getParticipantPhotoURL(metadata);
  const displayName = name || identity;
  
  const handleVolumeChange = (value: number[]) => {
      const newVolume = value[0];
      setVolume(newVolume);
      if (newVolume > 0 && isMutedForUser) {
          setIsMutedForUser(false);
      }
  };

  const toggleLocalMic = () => {
    if (isLocal) {
        participant.setMicrophoneEnabled(!participant.isMicrophoneMuted);
    }
  };

  const effectiveVolume = isMutedForUser ? 0 : volume;

  return (
    <>
      {/* This renders the audio from remote participants so we can hear them */}
      {tracks.map(trackRef => (
        <AudioTrack
            key={trackRef.publication.trackSid}
            trackRef={trackRef}
            volume={effectiveVolume}
        />
      ))}
      <Card className="flex flex-col h-full">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className={cn("h-12 w-12 transition-all", isSpeaking && "ring-2 ring-primary ring-offset-2 ring-offset-card")}>
                <AvatarImage src={photoURL} alt={displayName} data-ai-hint="person portrait" />
                <AvatarFallback>{displayName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              {isMicrophoneMuted && (
                  <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-1 border-2 border-card">
                      <MicOff className="w-3 h-3 text-destructive-foreground" />
                  </div>
              )}
            </div>
            <CardTitle className="font-headline text-lg flex-1 truncate">{displayName}</CardTitle>
          </div>
          <div className="flex justify-center items-center mt-2 gap-1 h-9">
              {isLocal && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isMicrophoneMuted ? 'destructive' : 'secondary'}
                        size="icon"
                        onClick={toggleLocalMic}
                        aria-label="Toggle Mic Broadcast"
                      >
                          <Mic className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{isMicrophoneMuted ? 'Unmute Microphone' : 'Mute Microphone'}</p></TooltipContent>
                  </Tooltip>
              )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 flex-grow justify-end">
          <SpeakingIndicator isSpeaking={isSpeaking} />

          {!isLocal && (
            <div className="flex items-center gap-2">
              <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => setIsMutedForUser(!isMutedForUser)} aria-label={isMutedForUser ? "Unmute" : "Mute"}>
                        {isMutedForUser ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isMutedForUser ? 'Unmute' : 'Mute'}</p></TooltipContent>
              </Tooltip>
              <Slider
                aria-label="Volume"
                value={[isMutedForUser ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.05}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

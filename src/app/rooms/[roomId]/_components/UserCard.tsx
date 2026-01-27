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
import { type Participant, Track } from 'livekit-client';
import { useState } from 'react';


export default function UserCard({ 
    participant,
    isLocal,
}: { 
    participant: Participant;
    isLocal: boolean;
}) {
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);

  const getParticipantPhotoURL = (metadata: string | undefined): string => {
    if (!metadata) return `https://picsum.photos/seed/${participant.identity}/100/100`;
    try {
      const parsed = JSON.parse(metadata);
      return parsed.photoURL || `https://picsum.photos/seed/${participant.identity}/100/100`;
    } catch (e) {
      console.error('Failed to parse participant metadata:', metadata, e);
      return `https://picsum.photos/seed/${participant.identity}/100/100`;
    }
  };

  const name = participant.name || participant.identity;
  const photoURL = getParticipantPhotoURL(participant.metadata);

  const handleVolumeChange = (value: number[]) => {
      setVolume(value[0]);
      if (value[0] > 0 && isMuted) setIsMuted(false);
  }
  
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: true })
    .filter(ref => ref.participant.identity === participant.identity);

  return (
    <>
      {!isLocal && tracks.map(trackRef => (
        <AudioTrack 
            key={trackRef.publication.trackSid} 
            trackRef={trackRef} 
            volume={isMuted ? 0 : volume}
        />
      ))}
      <Card className="flex flex-col h-full">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className={cn("h-12 w-12 transition-all", participant.isSpeaking && "ring-2 ring-primary ring-offset-2 ring-offset-card")}>
                <AvatarImage src={photoURL} alt={name} data-ai-hint="person portrait" />
                <AvatarFallback>{name.charAt(0)}</AvatarFallback>
              </Avatar>
              {participant.isMicrophoneMuted && (
                  <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-1 border-2 border-card">
                      <MicOff className="w-3 h-3 text-destructive-foreground" />
                  </div>
              )}
            </div>
            <CardTitle className="font-headline text-lg flex-1 truncate">{name}</CardTitle>
          </div>
          <div className="flex justify-center items-center mt-2 gap-1 h-9">
              {isLocal && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant={!participant.isMicrophoneMuted ? 'secondary' : 'ghost'} size="icon" onClick={() => participant.setMicrophoneEnabled(!participant.isMicrophoneEnabled)} aria-label="Toggle Mic Broadcast">
                          <Mic className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Toggle Mic</p></TooltipContent>
                  </Tooltip>
              )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 flex-grow justify-end">
          <SpeakingIndicator isSpeaking={participant.isSpeaking} />
          
          {!isLocal && (
            <div className="flex items-center gap-2">
              <Tooltip>
                  <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => setIsMuted(!isMuted)} aria-label={isMuted ? "Unmute" : "Mute"}>{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</Button></TooltipTrigger>
                  <TooltipContent><p>{isMuted ? 'Unmute' : 'Mute'}</p></TooltipContent>
              </Tooltip>
              <Slider
                aria-label="Volume"
                value={[isMuted ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.05}
                disabled={isMuted}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
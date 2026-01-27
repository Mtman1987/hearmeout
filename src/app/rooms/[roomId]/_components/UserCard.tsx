'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Volume2, VolumeX, MicOff, MoreVertical, Ban, LogOut, ArrowRightLeft, Mic } from "lucide-react";
import { SpeakingIndicator } from "./SpeakingIndicator";
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalParticipant, AudioTrack, useTracks } from '@livekit/components-react';
import type { Participant, Track } from 'livekit-client';

export default function UserCard({ 
    participant,
    isHost, 
    onKick, 
    onBan, 
    onMove, 
    onMute,
    isRoomOwner,
    onDeleteRoom,
}: { 
    participant: Participant;
    isHost?: boolean; 
    onKick?: (identity: string) => void;
    onBan?: (identity: string) => void;
    onMute?: (identity: string, shouldMute: boolean) => void;
    onMove?: (user: { id: string; name: string; }) => void;
    isRoomOwner?: boolean;
    onDeleteRoom?: () => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const isLocal = participant.isLocal;
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);

  const getParticipantPhotoURL = (metadata: string | undefined): string => {
    if (!metadata) return `https://picsum.photos/seed/${Math.random()}/100/100`;
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
              {isLocal ? (
                  <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant={localParticipant?.isMicrophoneEnabled ? 'secondary' : 'ghost'} size="icon" onClick={() => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)} aria-label="Toggle Mic Broadcast">
                          <Mic className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Toggle Mic</p></TooltipContent>
                  </Tooltip>
                  {isRoomOwner && (
                    <AlertDialog>
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-5 w-5" />
                                <span className="sr-only">Room Settings</span>
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Room Settings</p>
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled>Edit Room Name</DropdownMenuItem>
                          <DropdownMenuItem disabled>Make Private</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive hover:!bg-destructive/90 hover:!text-destructive-foreground focus:!bg-destructive/90 focus:!text-destructive-foreground">
                              Delete Room
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the room and remove all users.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={onDeleteRoom}
                            className={buttonVariants({ variant: 'destructive' })}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  </>
              ) : isHost ? (
                  <>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onMove?.({id: participant.identity, name: name})}><ArrowRightLeft className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Move to another room</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onMute?.(participant.identity, !participant.isMicrophoneMuted)}><MicOff className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>{participant.isMicrophoneMuted ? 'Unmute for Room' : 'Mute for Room'}</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onKick?.(participant.identity)}><LogOut className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Kick</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onBan?.(participant.identity)}><Ban className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Ban</TooltipContent></Tooltip>
                  </>
              ) : null}
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

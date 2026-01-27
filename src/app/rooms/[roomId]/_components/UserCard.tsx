'use client';

import { useState, useEffect } from 'react';
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
import {
    Track,
} from 'livekit-client';
import { useLocalParticipant, useTracks } from '@livekit/components-react';

export default function UserCard({ user, isLocal, isHost, onKick, onBan, onMove, onMute, isRoomOwner, onDeleteRoom }: { 
    user: { id: string; name: string; photoURL: string; isSpeaking: boolean; isMutedByHost?: boolean; }; 
    isLocal?: boolean; 
    isHost?: boolean; 
    onKick?: (userId: string) => void;
    onBan?: (userId: string) => void;
    onMute?: (userId: string, shouldMute: boolean) => void;
    onMove?: (user: { id: string; name: string; }) => void;
    isRoomOwner?: boolean;
    onDeleteRoom?: () => void;
}) {
  const params = useParams<{ roomId: string }>();

  // Audio settings for remote users
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const { localParticipant } = useLocalParticipant();

  const audioTracks = useTracks(
    [Track.Source.Microphone],
    { onlySubscribed: true }
  ).filter(trackRef => trackRef.participant.identity === user.id);


  // Load non-local user preferences from localStorage
  useEffect(() => {
    if (!isLocal) {
        const storageKey = `hearmeout-user-prefs-${params.roomId}`;
        try {
            const allPrefs = JSON.parse(localStorage.getItem(storageKey) || '{}');
            const userPrefs = allPrefs[user.id];
            if (userPrefs) {
                if (typeof userPrefs.volume === 'number') setVolume(userPrefs.volume);
                if (typeof userPrefs.isMuted === 'boolean') setIsMuted(userPrefs.isMuted);
            }
        } catch (e) {
            console.error("Failed to parse user preferences from localStorage", e);
        } finally {
            setIsLoaded(true);
        }
    } else {
        setIsLoaded(true);
    }
  }, [user.id, params.roomId, isLocal]);

  // Save non-local user preferences to localStorage
  useEffect(() => {
    if (!isLocal && isLoaded) {
        const storageKey = `hearmeout-user-prefs-${params.roomId}`;
        try {
            const allPrefs = JSON.parse(localStorage.getItem(storageKey) || '{}');
            if (!allPrefs[user.id]) allPrefs[user.id] = {};
            allPrefs[user.id].volume = volume;
            allPrefs[user.id].isMuted = isMuted;
            localStorage.setItem(storageKey, JSON.stringify(allPrefs));
        } catch (e) {
             console.error("Failed to save user preferences to localStorage", e);
        }
    }
  }, [volume, isMuted, user.id, params.roomId, isLocal, isLoaded]);
  

  const handleVolumeChange = (value: number[]) => {
      setVolume(value[0]);
      if (value[0] > 0 && isMuted) setIsMuted(false);
  }

  // Determine if the speaking indicator should be active
  let isVisuallySpeaking = user.isSpeaking && !user.isMutedByHost;
  if (!isLocal) {
      isVisuallySpeaking = isVisuallySpeaking && !isMuted;
  } else if (localParticipant) {
      isVisuallySpeaking = user.isSpeaking && localParticipant.isMicrophoneEnabled;
  }


  return (
    <>
       {!isLocal && audioTracks.map(trackRef => (
        <audio
          key={trackRef.publication.trackSid}
          ref={(el) => {
            if (el && trackRef.publication.track) {
              el.srcObject = trackRef.publication.track.mediaStream as MediaStream;
              el.volume = isMuted ? 0 : volume;
              el.play().catch(e => console.error("Remote audio play failed", e));
            }
          }}
          style={{ display: 'none' }}
        />
      ))}
      <Card className="flex flex-col h-full">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className={cn("h-12 w-12 transition-all", isVisuallySpeaking && "ring-2 ring-primary ring-offset-2 ring-offset-card")}>
                <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.id}/100/100`} alt={user.name} data-ai-hint="person portrait" />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              {(user.isMutedByHost || (isLocal && !localParticipant?.isMicrophoneEnabled)) && (
                  <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-1 border-2 border-card">
                      <MicOff className="w-3 h-3 text-destructive-foreground" />
                  </div>
              )}
            </div>
            <CardTitle className="font-headline text-lg flex-1 truncate">{user.name}</CardTitle>
          </div>
          <div className="flex justify-center items-center mt-2 gap-1 h-9">
              {isLocal ? (
                  <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant={localParticipant?.isMicrophoneEnabled ? 'secondary' : 'ghost'} size="icon" onClick={() => localParticipant?.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)} aria-label="Toggle Mic Broadcast">
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
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onMove?.({id: user.id, name: user.name})}><ArrowRightLeft className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Move to another room</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onMute?.(user.id, !user.isMutedByHost)}><MicOff className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>{user.isMutedByHost ? 'Unmute for Room' : 'Mute for Room'}</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onKick?.(user.id)}><LogOut className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Kick</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onBan?.(user.id)}><Ban className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Ban</TooltipContent></Tooltip>
                  </>
              ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 flex-grow justify-end">
          <SpeakingIndicator isSpeaking={isVisuallySpeaking} />
          
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

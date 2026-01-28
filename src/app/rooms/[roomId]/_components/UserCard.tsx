'use client';

import React, 'useEffect, useRef, useState' from 'react';
import {
  Headphones,
  Mic,
  MicOff,
  MoreVertical,
  Move,
  Music,
  Pen,
  ShieldOff,
  Trash2,
  UserX,
  Volume2,
  VolumeX,
  LoaderCircle
} from 'lucide-react';
import { useTracks, AudioTrack, useTrack } from '@livekit/components-react';
import * as LivekitClient from 'livekit-client';
import { doc, deleteDoc } from 'firebase/firestore';

import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SpeakingIndicator } from "./SpeakingIndicator";

interface RoomParticipantData {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string;
}

export default function UserCard({
    participant,
    isLocal,
    isHost,
    roomId,
    audioType,
}: {
    participant: LivekitClient.Participant;
    isLocal: boolean;
    isHost?: boolean;
    roomId: string;
    audioType: 'voice' | 'music';
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const isJukeboxCard = audioType === 'music';

  const [volume, setVolume] = React.useState(1);
  const [isMutedByMe, setIsMutedByMe] = React.useState(false);
  const lastNonZeroVolume = React.useRef(volume);
  
  const trackSource = isJukeboxCard ? LivekitClient.Track.Source.ScreenShareAudio : LivekitClient.Track.Source.Microphone;
  const tracks = useTracks([trackSource], { participant });
  const audioTrackRef = tracks[0];

  const { name, identity } = participant;

  const [trackAudioLevel, setTrackAudioLevel] = useState(0);

  useEffect(() => {
    if (audioTrackRef?.publication?.track) {
      const track = audioTrackRef.publication.track as LivekitClient.RemoteAudioTrack | LivekitClient.LocalAudioTrack;
      const interval = setInterval(() => {
        setTrackAudioLevel(track.audioLevel ?? 0);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [audioTrackRef]);
  
  const isSpeaking = trackAudioLevel > 0.1;

  useEffect(() => {
    if (isLocal) return;
    if (volume > 0) {
        lastNonZeroVolume.current = volume;
        setIsMutedByMe(false);
    } else {
        setIsMutedByMe(true);
    }
  }, [volume, isLocal]);
  
  const toggleMuteByMe = () => {
    if (isLocal) return;
    setVolume(prevVolume => (prevVolume > 0 ? 0 : lastNonZeroVolume.current || 1));
  };

  const userInRoomRef = useMemoFirebase(() => {
    if (!firestore || !roomId || !identity) return null;
    return doc(firestore, 'rooms', roomId, 'users', identity);
  }, [firestore, roomId, identity]);

  const { data: firestoreUser } = useDoc<RoomParticipantData>(userInRoomRef);
  
  const handleToggleMic = async () => {
    if (isLocal && !isJukeboxCard) {
        await participant.setMicrophoneEnabled(!participant.isMicrophoneEnabled);
    }
  };
  
  const isMuted = isJukeboxCard ? false : !participant.isMicrophoneEnabled;
  
  const participantMeta = participant.metadata ? JSON.parse(participant.metadata) : {};
  const displayName = isJukeboxCard ? 'Jukebox' : (name || participantMeta.displayName || firestoreUser?.displayName || 'User');
  const photoURL = isJukeboxCard ? '' : (participantMeta.photoURL || firestoreUser?.photoURL || `https://picsum.photos/seed/${identity}/100/100`);
  
  const handleDeleteRoom = async () => {
    if (!isHost || !firestore || !roomId) {
        toast({ variant: "destructive", title: "Error", description: "You do not have permission to delete this room." });
        return;
    };
    setIsDeleting(true);
    try {
        const roomRef = doc(firestore, 'rooms', roomId);
        await deleteDoc(roomRef);
        toast({ title: "Room Deleted", description: "The room has been successfully deleted." });
        window.location.assign('/');
    } catch (error) {
        console.error("Error deleting room:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the room.' });
        setIsDeleting(false);
    } finally {
        setIsDeleting(false);
    }
  };


  return (
    <>
      {!isLocal && audioTrackRef && (
        <AudioTrack key={audioTrackRef.publication.trackSid} trackRef={audioTrackRef} volume={volume} />
      )}

      <Card className="flex flex-col h-full">
        <CardContent className="p-4 flex flex-col gap-4 flex-grow">
            <div className="flex items-start gap-4">
                <div className="relative">
                    <Avatar className={cn("h-16 w-16 transition-all", isSpeaking && "ring-4 ring-primary ring-offset-2 ring-offset-card")}>
                        {isJukeboxCard ? (
                            <AvatarFallback>
                                <Music className="h-8 w-8" />
                            </AvatarFallback>
                        ) : (
                            <>
                                <AvatarImage src={photoURL} alt={displayName || 'User'} data-ai-hint="person portrait" />
                                <AvatarFallback>{displayName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                            </>
                        )}
                    </Avatar>
                     {(isMuted && !isJukeboxCard) && (
                        <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-1 border-2 border-card">
                            <MicOff className="w-3 h-3 text-destructive-foreground" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate">{displayName}</p>
                    {isLocal && !isJukeboxCard ? (
                         <div className="flex items-center gap-1 text-muted-foreground">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button variant={isMuted ? "destructive" : "ghost"} size="icon" onClick={handleToggleMic} className="h-7 w-7" disabled={!isLocal}>
                                        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{isMuted ? 'Unmute' : 'Mute'}</p></TooltipContent>
                            </Tooltip>

                            {isHost && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem disabled><Pen className="mr-2 h-4 w-4" /> Rename Room</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete Room
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                         </div>
                    ): (
                        isHost && !isJukeboxCard && (
                           <div className='flex items-center gap-1'>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7"><UserX className="h-4 w-4" /></Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Kick</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled><ShieldOff className="h-4 w-4" /></Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Ban</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled><MicOff className="h-4 w-4" /></Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Mute for Room</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled><Move className="h-4 w-4" /></Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Move to Room</p></TooltipContent>
                                </Tooltip>
                            </div>
                        )
                    )}
                </div>
            </div>
          
            <div className="space-y-2 flex-grow flex flex-col justify-end">
                 {!isLocal && (
                     <div className="flex items-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={toggleMuteByMe}
                                >
                                    {isMutedByMe ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{isMutedByMe ? 'Unmute' : 'Mute for me'}</p></TooltipContent>
                        </Tooltip>
                        <Slider
                            aria-label="Participant Volume"
                            value={[volume]}
                            onValueChange={(value) => setVolume(value[0])}
                            max={1}
                            step={0.05}
                        />
                    </div>
                )}
                <SpeakingIndicator audioLevel={isMuted ? 0 : trackAudioLevel} />
            </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this room and all of its associated data.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRoom} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <LoaderCircle className="animate-spin" /> : "Delete"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

'use client';

import React, { useEffect, useRef } from 'react';
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
import { useTracks, AudioTrack, useLocalParticipant } from '@livekit/components-react';
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
  isSpeaking: boolean;
  isMuted?: boolean;
}

export default function UserCard({
    participant,
    isLocal,
    isHost,
    roomId,
    isActingAsJukebox,
    jukeboxAudioTrack,
}: {
    participant: LivekitClient.Participant;
    isLocal: boolean;
    isHost?: boolean;
    roomId: string;
    isActingAsJukebox?: boolean;
    jukeboxAudioTrack?: MediaStreamTrack | null;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const { isSpeaking, name, identity, audioLevel } = participant;
  const { localParticipant } = useLocalParticipant();
  
  const [volume, setVolume] = React.useState(1);
  const [isMutedByMe, setIsMutedByMe] = React.useState(false);
  const lastNonZeroVolume = React.useRef(volume);

  const audioTracks = useTracks(
    [LivekitClient.Track.Source.Microphone], 
    { participant }
  );

  useEffect(() => {
    if (isLocal && isActingAsJukebox && jukeboxAudioTrack && localParticipant) {
      const publishTrack = async () => {
        // Unpublish any existing microphone tracks
        const micPublication = localParticipant.getTrackPublication(LivekitClient.Track.Source.Microphone);
        if (micPublication && micPublication.track) {
          await localParticipant.unpublishTrack(micPublication.track, true);
        }
        
        // Publish the new jukebox audio track
        await localParticipant.publishTrack(jukeboxAudioTrack, {
          source: LivekitClient.Track.Source.Microphone,
          name: 'Jukebox',
        });
      };

      publishTrack().catch(err => {
        console.error("Failed to publish jukebox audio track:", err);
      });

      // Cleanup on dismount
      return () => {
        if (jukeboxAudioTrack) {
          localParticipant.unpublishTrack(jukeboxAudioTrack, true).catch(console.error);
        }
      };
    }
  }, [isLocal, isActingAsJukebox, jukeboxAudioTrack, localParticipant]);


  React.useEffect(() => {
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

  React.useEffect(() => {
    if (userInRoomRef && firestoreUser && isSpeaking !== firestoreUser.isSpeaking) {
      updateDocumentNonBlocking(userInRoomRef, { isSpeaking });
    }
  }, [isSpeaking, userInRoomRef, firestoreUser]);


  const isMuted = firestoreUser?.isMuted ?? false;

  React.useEffect(() => {
    // We don't manage the Jukebox's mic track here anymore, it's handled by the jukeboxAudioTrack effect
    if (isLocal && !isActingAsJukebox) {
        const micTrack = audioTracks[0]?.publication.track;
        if (micTrack && 'setMuted' in micTrack && typeof micTrack.setMuted === 'function') {
          if (micTrack.isMuted !== isMuted) {
              micTrack.setMuted(isMuted);
          }
        }
    }
  }, [isLocal, audioTracks, isMuted, isActingAsJukebox]);
  
  const handleToggleMic = async () => {
    if (isLocal && userInRoomRef) {
        updateDocumentNonBlocking(userInRoomRef, { isMuted: !isMuted });
    }
  };
  
  const participantMeta = participant.metadata ? JSON.parse(participant.metadata) : {};
  const displayName = isActingAsJukebox ? 'Jukebox' : (name || participantMeta.displayName || firestoreUser?.displayName || 'User');
  const photoURL = isActingAsJukebox ? '' : (participantMeta.photoURL || firestoreUser?.photoURL || `https://picsum.photos/seed/${identity}/100/100`);
  
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
      {!isLocal && audioTracks.map((trackRef) => (
        <AudioTrack key={trackRef.publication.trackSid} trackRef={trackRef} volume={volume} />
      ))}

      <Card className="flex flex-col h-full">
        <CardContent className="p-4 flex flex-col gap-4 flex-grow">
            <div className="flex items-start gap-4">
                <div className="relative">
                    <Avatar className={cn("h-16 w-16 transition-all", isSpeaking && "ring-4 ring-primary ring-offset-2 ring-offset-card")}>
                        {isActingAsJukebox ? (
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
                     {(isMuted && !isActingAsJukebox) && (
                        <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-1 border-2 border-card">
                            <MicOff className="w-3 h-3 text-destructive-foreground" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate">{displayName}</p>
                    {isLocal && !isActingAsJukebox ? (
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
                        isHost && !isActingAsJukebox && (
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
                <SpeakingIndicator audioLevel={isMuted ? 0 : audioLevel} />
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

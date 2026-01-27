'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreVertical,
  Trash2,
  LoaderCircle,
  Volume2,
  VolumeX,
  MicOff,
  Mic,
} from 'lucide-react';
import {
  useTracks,
  AudioTrack,
} from '@livekit/components-react';
import { Track, type Participant } from 'livekit-client';
import { doc, deleteDoc } from 'firebase/firestore';

import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SpeakingIndicator } from "./SpeakingIndicator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


export default function UserCard({
    participant,
    isHost,
    roomId,
}: {
    participant: Participant;
    isHost?: boolean;
    roomId: string;
}) {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteRoom = async () => {
    if (!isHost || !firestore || !roomId) {
        toast({ variant: "destructive", title: "Error", description: "You do not have permission to delete this room." });
        return;
    };
    setIsDeleting(true);
    const roomRef = doc(firestore, 'rooms', roomId);
    try {
        await deleteDoc(roomRef);
        toast({ title: "Room Deleted", description: "The room has been successfully deleted." });
        router.push('/');
    } catch (error) {
        console.error("Error deleting room:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the room.' });
        setIsDeleting(false);
    }
  };

  const effectiveVolume = isMutedForUser ? 0 : volume;

  return (
    <>
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

            {isLocal && isHost && (
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                      <span className="sr-only">Room Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2" />
                      Delete Room
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 flex-grow justify-end">
          <SpeakingIndicator isSpeaking={isSpeaking} />

           {isLocal ? (
             <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isMicrophoneMuted ? 'destructive' : 'secondary'}
                    onClick={toggleLocalMic}
                    aria-label="Toggle Mic Broadcast"
                    className="w-full"
                  >
                      <Mic className="h-5 w-5 mr-2" />
                      {isMicrophoneMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{isMicrophoneMuted ? 'Unmute Microphone' : 'Mute Microphone'}</p></TooltipContent>
              </Tooltip>
            ) : (
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
      
      {isLocal && isHost && (
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
      )}
    </>
  );
}
'use client';

import React, { useState, useEffect } from 'react';
import {
  Headphones,
  Mic,
  MicOff,
  MoreVertical,
  Move,
  Pen,
  ShieldOff,
  Trash2,
  UserX,
  Volume2,
  VolumeX,
  LoaderCircle
} from 'lucide-react';
import { useTracks, AudioTrack, useMediaDeviceSelect, useRoomContext } from '@livekit/components-react';
import { Track, type Participant, RoomEvent } from 'livekit-client';
import { doc, deleteDoc } from 'firebase/firestore';

import { useFirebase } from '@/firebase';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SpeakingIndicator } from "./SpeakingIndicator";


export default function UserCard({
    participant,
    isHost,
    roomId,
}: {
    participant: Participant;
    isHost?: boolean;
    roomId: string;
}) {
  const { firestore, user: firebaseUser } = useFirebase();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for remote participants' volume
  const [volume, setVolume] = useState(1);
  const [isMutedForUser, setIsMutedForUser] = useState(false);
  
  const { isLocal, isMicrophoneMuted, isSpeaking, name, identity, audioLevel } = participant;

  const tracks = useTracks(
    [Track.Source.Microphone],
    { participant }
  );
  
  // Use LiveKit's built-in hooks for device management, which is more robust
  const { devices: speakerDevices, activeDeviceId: activeSpeakerId, setMediaDevice: setSpeakerDevice } = useMediaDeviceSelect({ kind: 'audiooutput' });
  const { devices: micDevices, activeDeviceId: activeMicId, setMediaDevice: setMicDevice } = useMediaDeviceSelect({ kind: 'audioinput' });

  // Handle setting the microphone device
  const handleMicDeviceChange = (deviceId: string) => {
    setMicDevice(deviceId);
    localStorage.setItem('hearmeout-user-mic-device-id', deviceId);
  };
  
  // On mount, try to set the microphone to the one saved in local storage
  useEffect(() => {
    if (isLocal) {
        const savedMicId = localStorage.getItem('hearmeout-user-mic-device-id');
        if (savedMicId) {
            setMicDevice(savedMicId);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal, setMicDevice]);


  // Use Firebase data for local user, LiveKit data for remote
  const displayName = isLocal ? firebaseUser?.displayName || name : name;
  const photoURL = isLocal ? firebaseUser?.photoURL : participant.metadata ? JSON.parse(participant.metadata).photoURL : undefined;
  
  const handleVolumeChange = (value: number[]) => {
      const newVolume = value[0];
      setVolume(newVolume);
      if (newVolume > 0 && isMutedForUser) {
          setIsMutedForUser(false);
      }
  };

  const toggleLocalMic = () => {
    if (isLocal) {
        const micTrackRef = tracks.find(trackRef => trackRef.source === Track.Source.Microphone);
        if (micTrackRef && micTrackRef.publication) {
           micTrackRef.publication.setMuted(!isMicrophoneMuted);
        }
    }
  };
  
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
        // Use window.location to force a full page reload, clearing any broken state.
        window.location.assign('/');
    } catch (error) {
        console.error("Error deleting room:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the room.' });
        setIsDeleting(false);
    } finally {
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
            volume={!isLocal ? effectiveVolume : undefined}
        />
      ))}

      <Card className="flex flex-col h-full">
        <CardContent className="p-4 flex flex-col gap-4 flex-grow">
            <div className="flex items-start gap-4">
                <div className="relative">
                    <Avatar className={cn("h-16 w-16 transition-all", isSpeaking && "ring-4 ring-primary ring-offset-2 ring-offset-card")}>
                        <AvatarImage src={photoURL || `https://picsum.photos/seed/${identity}/100/100`} alt={displayName || 'User'} data-ai-hint="person portrait" />
                        <AvatarFallback>{displayName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                     {isMicrophoneMuted && (
                        <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-1 border-2 border-card">
                            <MicOff className="w-3 h-3 text-destructive-foreground" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate">{displayName}</p>
                    {isLocal ? (
                         <div className="flex items-center gap-1 text-muted-foreground">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7"><Headphones className="h-4 w-4" /></Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <h4 className="font-medium leading-none">Audio Settings</h4>
                                            <p className="text-sm text-muted-foreground">Manage your input and output settings.</p>
                                        </div>
                                         <div className="grid gap-4">
                                            <div className="grid grid-cols-3 items-center gap-4">
                                                <Label htmlFor='audioinput'>Microphone</Label>
                                                <Select onValueChange={handleMicDeviceChange} value={activeMicId} disabled={micDevices.length === 0}>
                                                    <SelectTrigger id='audioinput' className="col-span-2">
                                                        <SelectValue placeholder="Select a microphone" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {micDevices.map((device) => (
                                                            <SelectItem key={device.deviceId} value={device.deviceId}>
                                                                {device.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-4">
                                                <Label htmlFor='audiooutput'>Speaker</Label>
                                                <Select onValueChange={setSpeakerDevice} value={activeSpeakerId} disabled={speakerDevices.length === 0}>
                                                    <SelectTrigger id='audiooutput' className="col-span-2">
                                                        <SelectValue placeholder="Select a speaker" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {speakerDevices.map((device) => (
                                                            <SelectItem key={device.deviceId} value={device.deviceId}>
                                                                {device.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-4">
                                                <Label htmlFor="push-to-talk">Push to Talk</Label>
                                                <Switch id="push-to-talk" className="col-span-2" disabled />
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-4">
                                                <Label htmlFor="monitoring">Monitoring</Label>
                                                <Switch id="monitoring" className="col-span-2" disabled />
                                            </div>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button variant="ghost" size="icon" onClick={toggleLocalMic} className="h-7 w-7">
                                        {isMicrophoneMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{isMicrophoneMuted ? 'Unmute' : 'Mute'}</p></TooltipContent>
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
                        isHost && (
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
                <SpeakingIndicator audioLevel={audioLevel} />
                {!isLocal && (
                    <div className="flex items-center gap-2 pt-2">
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsMutedForUser(!isMutedForUser)} aria-label={isMutedForUser ? "Unmute" : "Mute"}>
                            {isMutedForUser ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </Button>
                        <Slider
                            aria-label="Volume"
                            value={[isMutedForUser ? 0 : volume]}
                            onValueChange={handleVolumeChange}
                            max={1}
                            step={0.05}
                        />
                    </div>
                )}
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

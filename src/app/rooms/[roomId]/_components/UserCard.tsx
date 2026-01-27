'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2, VolumeX, MicOff, Headphones, MoreVertical, Ban, LogOut, ArrowRightLeft, Mic } from "lucide-react";
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

  // Audio settings state
  const [volume, setVolume] = useState(isLocal ? 1 : 0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('default');
  const [selectedOutput, setSelectedOutput] = useState<string>('default');
  const [monitoring, setMonitoring] = useState(false);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);

  // Refs for audio processing
  const monitorAudioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  const { localParticipant } = useLocalParticipant();

  const audioTracks = useTracks(
    [Track.Source.Microphone],
    { onlySubscribed: true }
  ).filter(trackRef => trackRef.participant.identity === user.id);


  // Load non-local user preferences from localStorage
  useEffect(() => {
    setIsLoaded(false);
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
  
  // Get available media devices
  useEffect(() => {
    async function getMediaDevices() {
        if (isLocal && typeof navigator !== 'undefined' && navigator.mediaDevices) {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                setInputDevices(devices.filter(d => d.kind === 'audioinput'));
                setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
            } catch(e) {
                console.error("Could not get media devices", e);
            }
        }
    }
    getMediaDevices();
  }, [isLocal]);

  // Core monitoring logic
  useEffect(() => {
    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (monitorAudioRef.current) {
        monitorAudioRef.current.srcObject = null;
      }
      setLocalAudioLevel(0);
    };

    if (!isLocal || !monitoring || !localParticipant) {
      cleanup();
      return;
    }

    const setupMonitoring = async () => {
      try {
        const audioTrack = localParticipant.getTrack(Track.Source.Microphone);
        const stream = audioTrack?.mediaStream;

        if (!stream) {
          console.warn("Local microphone track not available for monitoring.");
          return;
        }

        // Setup for audio analysis (visualizer)
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (const amplitude of dataArray) {
            sum += Math.abs(amplitude - 128);
          }
          setLocalAudioLevel(sum / dataArray.length / 128);
          animationFrameRef.current = requestAnimationFrame(draw);
        };
        draw();

        // Setup for audio playback to selected device
        if (monitorAudioRef.current) {
          monitorAudioRef.current.srcObject = stream;
          monitorAudioRef.current.volume = isMuted ? 0 : volume;
          monitorAudioRef.current.muted = false;
          if (selectedOutput && 'setSinkId' in monitorAudioRef.current) {
            await (monitorAudioRef.current as any).setSinkId(selectedOutput);
          }
          await monitorAudioRef.current.play();
        }
      } catch (err) {
        console.error('Error setting up audio monitoring:', err);
      }
    };

    setupMonitoring();

    return cleanup;
  }, [isLocal, monitoring, selectedOutput, localParticipant, isMuted, volume]);


  // Effect to update volume/mute of the monitoring audio element
  useEffect(() => {
    if (isLocal && monitorAudioRef.current) {
      monitorAudioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [isLocal, volume, isMuted]);

  const handleVolumeChange = (value: number[]) => {
      setVolume(value[0]);
      if (value[0] > 0 && isMuted) setIsMuted(false);
  }

  // Determine if the speaking indicator should be active
  const isVisuallySpeaking = isLocal ? localAudioLevel > 0.05 : user.isSpeaking;

  return (
    <>
      {isLocal && <audio ref={monitorAudioRef} style={{ display: "none" }} />}
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
              <Avatar className={cn("h-12 w-12 transition-all", isVisuallySpeaking && !isMuted && !user.isMutedByHost && "ring-2 ring-primary ring-offset-2 ring-offset-card")}>
                <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.id}/100/100`} alt={user.name} data-ai-hint="person portrait" />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              {user.isMutedByHost && (
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
                    <TooltipContent>Toggle Mic</TooltipContent>
                  </Tooltip>
                  <Dialog>
                      <Tooltip>
                          <TooltipTrigger asChild>
                              <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Audio Settings">
                                  <Headphones className="h-5 w-5" />
                              </Button>
                              </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent><p>Audio Settings</p></TooltipContent>
                      </Tooltip>
                      <DialogContent>
                      <DialogHeader><DialogTitle>Audio Settings</DialogTitle></DialogHeader>
                      <div className="space-y-4 text-sm pt-4">
                          <div className="space-y-2">
                              <Label htmlFor="input-device">Input Device</Label>
                              <Select value={selectedInput} onValueChange={(value) => { setSelectedInput(value); localParticipant?.setMicrophoneDevice({ deviceId: value }); }} disabled={inputDevices.length === 0}>
                                  <SelectTrigger id="input-device"><SelectValue placeholder="Select input device" /></SelectTrigger>
                                  <SelectContent>
                                      {inputDevices.map(device => (<SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `microphone ${inputDevices.indexOf(device) + 1}`}</SelectItem>))}
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="output-device">Output Device</Label>
                              <Select value={selectedOutput} onValueChange={setSelectedOutput} disabled={outputDevices.length === 0}>
                                  <SelectTrigger id="output-device"><SelectValue placeholder="Select output device" /></SelectTrigger>
                                  <SelectContent>
                                      {outputDevices.map(device => (<SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `speaker ${outputDevices.indexOf(device) + 1}`}</SelectItem>))}
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="flex items-center justify-between">
                              <Label htmlFor="monitoring" className="flex items-center gap-2 cursor-pointer"><Headphones className="h-4 w-4" /> Monitor Own Voice</Label>
                              <Switch id="monitoring" checked={monitoring} onCheckedChange={setMonitoring} />
                          </div>
                      </div>
                      </DialogContent>
                  </Dialog>
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
          <SpeakingIndicator isSpeaking={isVisuallySpeaking && !isMuted && !user.isMutedByHost} />
          
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
        </CardContent>
      </Card>
    </>
  );
}

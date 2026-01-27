'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2, VolumeX, MicOff, Headphones, MoreVertical } from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";
import { SpeakingIndicator } from "./SpeakingIndicator";
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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


export default function UserCard({ user, isLocal }: { user: { id: number; name: string; avatarId: string; isSpeaking: boolean; }; isLocal?: boolean; }) {
  const params = useParams();
  const roomId = params.roomId as string;

  const [volume, setVolume] = useState(isLocal ? 1 : 0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('default');
  const [selectedOutput, setSelectedOutput] = useState<string>('default');
  const [pushToTalk, setPushToTalk] = useState(false);
  const [monitoring, setMonitoring] = useState(true);

  // Effect to load settings from localStorage on mount
  useEffect(() => {
    if (!isLocal) { 
        const storageKey = `hearmeout-user-prefs-${roomId}`;
        try {
            const allPrefs = JSON.parse(localStorage.getItem(storageKey) || '{}');
            const userPrefs = allPrefs[user.id];
            if (userPrefs) {
                if (typeof userPrefs.volume === 'number') {
                    setVolume(userPrefs.volume);
                }
                if (typeof userPrefs.isMuted === 'boolean') {
                    setIsMuted(userPrefs.isMuted);
                }
            }
        } catch (e) {
            console.error("Failed to parse user preferences from localStorage", e);
        }
    }
  }, [user.id, roomId, isLocal]);

  // Effect to save settings to localStorage on change
  useEffect(() => {
    if (!isLocal) {
        const storageKey = `hearmeout-user-prefs-${roomId}`;
        try {
            const allPrefs = JSON.parse(localStorage.getItem(storageKey) || '{}');
            if (!allPrefs[user.id]) {
                allPrefs[user.id] = {};
            }
            allPrefs[user.id].volume = volume;
            allPrefs[user.id].isMuted = isMuted;
            localStorage.setItem(storageKey, JSON.stringify(allPrefs));
        } catch (e) {
             console.error("Failed to save user preferences to localStorage", e);
        }
    }
  }, [volume, isMuted, user.id, roomId, isLocal]);

  useEffect(() => {
    async function getMediaDevices() {
        if (isLocal && typeof navigator !== 'undefined' && navigator.mediaDevices) {
            try {
                // Request permissions
                await navigator.mediaDevices.getUserMedia({ audio: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
                setInputDevices(audioInputs);
                setOutputDevices(audioOutputs);
            } catch(e) {
                console.error("Could not get media devices", e);
            }
        }
    }
    getMediaDevices();
  }, [isLocal]);

  const avatar = placeholderData.placeholderImages.find(p => p.id === user.avatarId);

  const handleVolumeChange = (value: number[]) => {
      setVolume(value[0]);
      if (value[0] > 0 && isMuted) {
          setIsMuted(false);
      }
  }

  return (
    <Card className="flex flex-col h-full border">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className={cn("h-12 w-12 transition-all", user.isSpeaking && !isMuted && "ring-2 ring-primary ring-offset-2 ring-offset-card")}>
              {avatar && <AvatarImage src={avatar.imageUrl} alt={user.name} data-ai-hint={avatar.imageHint} />}
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="font-headline text-lg flex-1 truncate">{user.name}</CardTitle>
        </div>
         <div className="flex justify-center mt-2 gap-2 h-9">
            {isLocal && (
                <>
                <Dialog>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Audio Settings">
                                <Headphones className="h-5 w-5" />
                            </Button>
                            </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Audio Settings</p>
                        </TooltipContent>
                    </Tooltip>
                    <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Audio Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="input-device">Input Device</Label>
                            <Select value={selectedInput} onValueChange={setSelectedInput} disabled={inputDevices.length === 0}>
                                <SelectTrigger id="input-device">
                                    <SelectValue placeholder="Select input device" />
                                </SelectTrigger>
                                <SelectContent>
                                    {inputDevices.map(device => (
                                        <SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `microphone ${inputDevices.indexOf(device) + 1}`}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="output-device">Output Device</Label>
                            <Select value={selectedOutput} onValueChange={setSelectedOutput} disabled={outputDevices.length === 0}>
                                <SelectTrigger id="output-device">
                                    <SelectValue placeholder="Select output device" />
                                </SelectTrigger>
                                <SelectContent>
                                    {outputDevices.map(device => (
                                        <SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `speaker ${outputDevices.indexOf(device) + 1}`}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="push-to-talk" className="flex items-center gap-2 cursor-pointer">
                                <MicOff className="h-4 w-4" /> Push to Talk
                            </Label>
                            <Switch id="push-to-talk" checked={pushToTalk} onCheckedChange={setPushToTalk} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="monitoring" className="flex items-center gap-2 cursor-pointer">
                                <Headphones className="h-4 w-4" /> Monitor Own Voice
                            </Label>
                            <Switch id="monitoring" checked={monitoring} onCheckedChange={setMonitoring} />
                        </div>
                    </div>
                    </DialogContent>
                </Dialog>
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
                        <DropdownMenuItem>Edit Room Name</DropdownMenuItem>
                        <DropdownMenuItem>Make Private</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Delete Room</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                </>
            )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-grow justify-end">
        <SpeakingIndicator isSpeaking={user.isSpeaking && !isMuted} />
        
        <div className="flex items-center gap-2">
          <Tooltip>
              <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setIsMuted(!isMuted)} aria-label={isMuted ? "Unmute" : "Mute"}>
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
              </TooltipTrigger>
              <TooltipContent>
                  <p>{isMuted ? 'Unmute' : 'Mute'}</p>
              </TooltipContent>
          </Tooltip>
          <Slider
            aria-label="Volume"
            value={[isMuted ? 0 : volume]}
            onValueChange={handleVolumeChange}
            max={1}
            step={0.05}
            disabled={!isLocal && isMuted}
          />
        </div>
      </CardContent>
    </Card>
  );
}

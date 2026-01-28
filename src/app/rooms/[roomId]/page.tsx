'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ReactPlayer from 'react-player/youtube';
import {
  LiveKitRoom,
  useConnectionState,
} from '@livekit/components-react';
import { ConnectionState, Room, type Participant } from 'livekit-client';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Copy, MessageSquare, X, LoaderCircle, Headphones, Music } from 'lucide-react';
import LeftSidebar from '@/app/components/LeftSidebar';
import UserList from './_components/UserList';
import ChatBox from './_components/ChatBox';
import MusicPlayerCard from './_components/MusicPlayerCard';
import PlaylistPanel from './_components/PlaylistPanel';
import AddMusicPanel from './_components/AddMusicPanel';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { generateLiveKitToken, postToDiscord } from '@/app/actions';
import { PlaylistItem } from './_components/Playlist';

interface RoomData {
  name: string;
  ownerId: string;
  playlist: PlaylistItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
  djId?: string;
  djDisplayName?: string;
}

function ConnectionStatusIndicator() {
    const connectionState = useConnectionState();

    let indicatorClass = '';
    let statusText = '';

    switch (connectionState) {
        case ConnectionState.Connected:
            indicatorClass = 'bg-green-500';
            statusText = 'Connected';
            break;
        case ConnectionState.Connecting:
            indicatorClass = 'bg-yellow-500 animate-pulse';
            statusText = 'Connecting';
            break;
        case ConnectionState.Disconnected:
            indicatorClass = 'bg-red-500';
            statusText = 'Disconnected';
            break;
        case ConnectionState.Reconnecting:
            indicatorClass = 'bg-yellow-500 animate-pulse';
            statusText = 'Reconnecting';
            break;
        default:
            indicatorClass = 'bg-gray-500';
            statusText = 'Unknown';
    }

    return (
        <Tooltip>
            <TooltipTrigger>
                <div className={cn("h-2.5 w-2.5 rounded-full", indicatorClass)} />
            </TooltipTrigger>
            <TooltipContent>
                <p>Voice: {statusText}</p>
            </TooltipContent>
        </Tooltip>
    );
}

const DiscordIcon = () => (
    <svg role="img" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.29 5.23a10.08 10.08 0 0 0-2.2-.62.84.84 0 0 0-1 .75c.18.25.36.5.52.75a8.62 8.62 0 0 0-4.14 0c.16-.25.34-.5.52-.75a.84.84 0 0 0-1-.75 10.08 10.08 0 0 0-2.2.62.81.81 0 0 0-.54.78c-.28 3.24.78 6.28 2.82 8.25a.85.85 0 0 0 .93.12 7.55 7.55 0 0 0 1.45-.87.82.82 0 0 1 .9-.06 6.53 6.53 0 0 0 2.22 0 .82.82 0 0 1 .9.06 7.55 7.55 0 0 0 1.45.87.85.85 0 0 0 .93-.12c2.04-1.97 3.1-5 2.82-8.25a.81.81 0 0 0-.55-.78zM10 11.85a1.45 1.45 0 0 1-1.45-1.45A1.45 1.45 0 0 1 10 8.95a1.45 1.45 0 0 1 1.45 1.45A1.45 1.45 0 0 1 10 11.85zm4 0a1.45 1.45 0 0 1-1.45-1.45A1.45 1.45 0 0 1 14 8.95a1.45 1.45 0 0 1 1.45 1.45A1.45 1.45 0 0 1 14 11.85z"/>
    </svg>
);

function RoomHeader({
    roomName,
    onToggleChat,
    isDJ,
    djId,
    onClaimDJ,
    onRelinquishDJ,
}: {
    roomName: string,
    onToggleChat: () => void,
    isDJ: boolean,
    djId: string | undefined,
    onClaimDJ: () => void,
    onRelinquishDJ: () => void;
}) {
    const { isMobile } = useSidebar();
    const params = useParams();
    const { toast } = useToast();
    const { user } = useFirebase();

    const copyOverlayUrl = () => {
        const url = `${window.location.origin}/overlay/${params.roomId}`;
        navigator.clipboard.writeText(url);
        toast({
            title: "Overlay URL Copied!",
            description: "You can now paste this into your streaming software.",
        });
    }

    const handlePostToDiscord = async () => {
        try {
            await postToDiscord();
            toast({
                title: "Posted to Discord!",
                description: "The control embed has been sent to your channel.",
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Discord Error",
                description: error.message || "Could not post to Discord. Check server logs.",
            });
        }
    }

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            <SidebarTrigger className={isMobile ? "" : "hidden md:flex"} />

            <div className="flex-1 flex items-center gap-4 truncate">
                <h2 className="text-xl font-bold font-headline truncate">{roomName}</h2>
                <ConnectionStatusIndicator />
            </div>

            <div className="flex flex-initial items-center justify-end space-x-2">
                 {(user && (!djId || isDJ)) && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={isDJ ? onRelinquishDJ : onClaimDJ} 
                                className={cn("transition-opacity", (!djId || user.uid === djId) ? "opacity-100" : "opacity-0 pointer-events-none")}
                                >
                                <Music className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isDJ ? 'Stop being the DJ' : 'Become the DJ'}</p>
                        </TooltipContent>
                    </Tooltip>
                )}
                
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handlePostToDiscord}>
                            <DiscordIcon />
                            <span className="sr-only">Post Controls to Discord</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Post Controls to Discord</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={copyOverlayUrl}>
                            <Copy className="h-4 w-4" />
                            <span className="sr-only">Copy Overlay URL</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Copy Overlay URL</p>
                    </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="outline" size="icon" onClick={() => onToggleChat()}>
                            <MessageSquare className="h-5 w-5" />
                            <span className="sr-only">Toggle Chat</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Toggle Chat</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </header>
    );
}

function RoomPageContent() {
  const params = useParams<{ roomId: string }>();
  const { firestore, user, isUserLoading } = useFirebase();
  const { toast } = useToast();
  
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceToken, setVoiceToken] = useState<string | undefined>(undefined);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  
  const [activePanels, setActivePanels] = useState({ playlist: false, add: false });
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerVolume, setPlayerVolume] = useState(0.5);
  
  const playerRef = useRef<ReactPlayer>(null);

  const roomRef = useMemoFirebase(() => {
      if (!firestore || !params.roomId) return null;
      return doc(firestore, 'rooms', params.roomId);
  }, [firestore, params.roomId]);

  const { data: room, isLoading: isRoomLoading, error: roomError } = useDoc<RoomData>(roomRef);

  const userInRoomRef = useMemoFirebase(() => {
    if (!firestore || !params.roomId || !user) return null;
    return doc(firestore, 'rooms', params.roomId, 'users', user.uid);
  }, [firestore, params.roomId, user]);
  
  const currentTrack = room?.playlist?.find(t => t.id === room.currentTrackId);
  const isDJ = !!user && !!room?.djId && user.uid === room.djId;

  const togglePanel = (panel: 'playlist' | 'add') => {
    setActivePanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  const handleClaimDJ = useCallback(() => {
    if (!roomRef || !user) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be signed in to become the DJ.' });
        return;
    };
    if (!userHasInteracted) {
        toast({ title: 'Action Required', description: 'Please join the voice chat before becoming the DJ.' });
        return;
    }
    updateDocumentNonBlocking(roomRef, {
        djId: user.uid,
        djDisplayName: user.displayName || 'Anonymous DJ'
    });
  }, [roomRef, user, toast, userHasInteracted]);

  const handleRelinquishDJ = useCallback(() => {
    if (!roomRef || !isDJ) return;
    updateDocumentNonBlocking(roomRef, {
        djId: '',
        djDisplayName: '',
        isPlaying: false,
    });
  }, [roomRef, isDJ]);

  const handlePlayPause = useCallback((playing: boolean) => {
    if (!roomRef || !isDJ) return;
    updateDocumentNonBlocking(roomRef, { isPlaying: playing });
  }, [roomRef, isDJ]);

  const handlePlayNext = useCallback(() => {
    if (!room || !roomRef || !isDJ) return;
    const { playlist, currentTrackId } = room;
    if (!playlist || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(t => t.id === currentTrackId);
    const nextIndex = (currentIndex + 1) % playlist.length;
    updateDocumentNonBlocking(roomRef, { currentTrackId: playlist[nextIndex].id, isPlaying: true });
  }, [room, roomRef, isDJ]);

  const handlePlayPrev = useCallback(() => {
    if (!room || !roomRef || !isDJ) return;
    const { playlist, currentTrackId } = room;
    if (!playlist || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(t => t.id === currentTrackId);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    updateDocumentNonBlocking(roomRef, { currentTrackId: playlist[prevIndex].id, isPlaying: true });
  }, [room, roomRef, isDJ]);

  const handlePlaySong = useCallback((songId: string) => {
    if (!roomRef || !isDJ) return;
    updateDocumentNonBlocking(roomRef, { currentTrackId: songId, isPlaying: true });
  }, [roomRef, isDJ]);
  
  const handleRemoveSong = useCallback((songId: string) => {
    if (!room || !roomRef || !isDJ) return;
    const newPlaylist = room.playlist.filter(s => s.id !== songId);
    updateDocumentNonBlocking(roomRef, { playlist: newPlaylist });
  }, [room, roomRef, isDJ]);
  
  const handleClearPlaylist = useCallback(() => {
    if (!roomRef || !isDJ) return;
    updateDocumentNonBlocking(roomRef, { playlist: [], currentTrackId: '', isPlaying: false });
  }, [roomRef, isDJ]);

  const handleAddItems = useCallback((items: PlaylistItem[]) => {
      if (!roomRef || !room || !isDJ) return;
      const currentPlaylist = room.playlist || [];
      const newPlaylist = [...currentPlaylist, ...items];
      const updates: any = { playlist: newPlaylist };
      if (!room.isPlaying && !room.currentTrackId && items.length > 0) {
          updates.currentTrackId = items[0].id;
          updates.isPlaying = true;
          setActivePanels({ playlist: true, add: true });
      }
      updateDocumentNonBlocking(roomRef, updates);
  }, [room, roomRef, isDJ]);

  const handleSeek = (seconds: number) => {
    if (playerRef.current && isDJ) {
        playerRef.current.seekTo(seconds, 'seconds');
    }
  };
  
  useEffect(() => {
    if (isUserLoading || !user || !params.roomId || voiceToken) return;

    let isCancelled = false;

    const setupUserAndToken = async () => {
        setDocumentNonBlocking(userInRoomRef!, {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`,
        }, { merge: true });

        try {
            const userToken = await generateLiveKitToken(params.roomId, user.uid, user.displayName!, JSON.stringify({ photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100` }));
            if (isCancelled) return;
            setVoiceToken(userToken);
        } catch (e) {
            if (!isCancelled) {
                console.error("Failed to generate voice token", e);
                toast({ variant: 'destructive', title: 'Connection Failed', description: 'Could not generate connection token.' });
            }
        }
    };

    if (userHasInteracted) {
        setupUserAndToken();
    }

    return () => {
        isCancelled = true;
        if (userInRoomRef) {
            deleteDocumentNonBlocking(userInRoomRef);
        }
    };
  }, [user, isUserLoading, params.roomId, voiceToken, userInRoomRef, toast, userHasInteracted]);

  useEffect(() => {
    const handleUnload = () => {
        if (roomRef && isDJ) {
             updateDocumentNonBlocking(roomRef, {
                djId: '',
                djDisplayName: '',
                isPlaying: false,
            });
        }
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => {
        window.removeEventListener('beforeunload', handleUnload);
        handleUnload(); // Also run on component unmount
    }
  }, [roomRef, isDJ]);
  
  useEffect(() => {
      if (isDJ) {
          setActivePanels({ playlist: true, add: true });
      } else {
          setActivePanels({ playlist: false, add: false });
      }
  }, [isDJ]);


  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const isLoading = isUserLoading || isRoomLoading || !livekitUrl;

  if (isLoading && !room) {
    return (
        <div className="flex flex-col h-screen">
             <LeftSidebar roomId={params.roomId} />
             <div className={cn("bg-secondary/30 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width-icon)_+_1rem)] md:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width)_+_1rem)] duration-200 transition-[margin-left,margin-right] flex-1")}>
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-center">
                    <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading room...</p>
                    </div>
                </div>
            </div>
        </div>
    );
  }
  
  if (!room) {
    return (
        <div className="flex flex-col h-screen">
            <LeftSidebar roomId={params.roomId} />
            <div className={cn("bg-secondary/30 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width-icon)_+_1rem)] md:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width)_+_1rem)] duration-200 transition-[margin-left,margin-right] flex-1")}>
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                    <h2 className="text-2xl font-bold">Room not found</h2>
                    <p className="text-muted-foreground">{roomError?.message || "This room may have been deleted or you may not have permission to view it."}</p>
                    <Button asChild>
                        <a href="/">Go to Dashboard</a>
                    </Button>
                </div>
            </div>
        </div>
    )
  }

  const showInitialConnectScreen = !userHasInteracted || !voiceToken;

  return (
    <>
        <LeftSidebar roomId={params.roomId} />
        <div className={cn(
          "bg-secondary/30 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width-icon)_+_1rem)] md:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width)_+_1rem)] duration-200 transition-[margin-left,margin-right]",
          chatOpen && "md:mr-[28rem]"
        )}>
            <SidebarInset>
                <div className="flex flex-col h-screen relative">
                    {showInitialConnectScreen ? (
                        <>
                            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
                                <SidebarTrigger className={cn(useSidebar().isMobile ? "" : "hidden md:flex")} />
                                <h2 className="text-xl font-bold font-headline truncate flex-1">{room.name}</h2>
                            </header>
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                                <h3 className="text-2xl font-bold font-headline mb-4">You're in the room</h3>
                                <p className="text-muted-foreground mb-8 max-w-sm">Click the button below to connect your microphone and speakers.</p>
                                <Button size="lg" onClick={() => setUserHasInteracted(true)} disabled={isUserLoading || !user}>
                                    {isUserLoading ? <LoaderCircle className='animate-spin' /> : <Headphones className="mr-2 h-5 w-5" />}
                                    Join Voice Chat
                                </Button>
                            </div>
                        </>
                    ) : (
                        <LiveKitRoom
                            serverUrl={livekitUrl}
                            token={voiceToken}
                            connect={true}
                            audio={true} 
                            video={false}
                            onError={(err) => {
                                console.error("LiveKit connection error:", err);
                                toast({ variant: 'destructive', title: 'Connection Error', description: err.message, });
                            }}
                        >
                            <RoomHeader
                                roomName={room.name}
                                onToggleChat={() => setChatOpen(!chatOpen)}
                                isDJ={isDJ}
                                djId={room.djId}
                                onClaimDJ={handleClaimDJ}
                                onRelinquishDJ={handleRelinquishDJ}
                            />
                            
                            <main className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
                                {isDJ && (
                                <div className="flex flex-col lg:flex-row gap-6">
                                    <div className="lg:w-1/3 shrink-0">
                                        <MusicPlayerCard
                                            currentTrack={currentTrack}
                                            progress={progress}
                                            duration={duration}
                                            playing={!!room.isPlaying}
                                            isPlayerControlAllowed={isDJ}
                                            onPlayPause={handlePlayPause}
                                            onPlayNext={handlePlayNext}
                                            onPlayPrev={handlePlayPrev}
                                            onSeek={handleSeek}
                                            onTogglePanel={togglePanel}
                                            activePanels={activePanels}
                                            playerVolume={playerVolume}
                                            onVolumeChange={setPlayerVolume}
                                        />
                                    </div>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                        {activePanels.playlist && (
                                            <div className={cn({ 'md:col-span-2': !activePanels.add })}>
                                                <PlaylistPanel
                                                    playlist={room.playlist || []}
                                                    currentTrackId={room.currentTrackId || ''}
                                                    isPlayerControlAllowed={isDJ}
                                                    onPlaySong={handlePlaySong}
                                                    onRemoveSong={handleRemoveSong}
                                                    onClearPlaylist={handleClearPlaylist}
                                                />
                                            </div>
                                        )}
                                        {activePanels.add && (
                                            <div className={cn({ 'md:col-span-2': !activePanels.playlist })}>
                                                <AddMusicPanel
                                                    onAddItems={handleAddItems}
                                                    onClose={() => {}}
                                                    canAddMusic={isDJ}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                )}
                                <UserList 
                                    roomId={params.roomId}
                                />
                                <div style={{ display: 'none' }}>
                                    <ReactPlayer
                                        ref={playerRef}
                                        url={currentTrack?.url || ''}
                                        playing={!!room?.isPlaying}
                                        volume={playerVolume}
                                        onProgress={({ playedSeconds }) => setProgress(playedSeconds)}
                                        onDuration={setDuration}
                                        onEnded={() => {
                                            if (isDJ) handlePlayNext();
                                        }}
                                        controls={false}
                                        width="1px"
                                        height="1px"
                                    />
                                </div>
                            </main>
                        </LiveKitRoom>
                    )}
                </div>
            </SidebarInset>
        </div>

        <div className={cn(
            "fixed inset-y-0 right-0 z-40 w-full sm:max-w-md transform transition-transform duration-300 ease-in-out bg-card border-l",
            chatOpen ? "translate-x-0" : "translate-x-full"
        )}>
            <div className="relative h-full">
                <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)} className="absolute top-4 right-4 z-50 md:hidden">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close Chat</span>
                </Button>
                <ChatBox />
            </div>
        </div>
    </>
  );
}

export default function RoomPage() {
    return (
        <SidebarProvider>
            <RoomPageContent />
        </SidebarProvider>
    );
}

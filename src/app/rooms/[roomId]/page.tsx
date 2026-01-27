'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  LiveKitRoom,
  useConnectionState,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Copy, MessageSquare, X, Music, LoaderCircle } from 'lucide-react';
import LeftSidebar from '@/app/components/LeftSidebar';
import UserList from './_components/UserList';
import ChatBox from './_components/ChatBox';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { generateLiveKitToken } from '@/app/actions';

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

function RoomHeader({ roomName, onToggleChat, onToggleMusicPlayer } : { roomName: string, onToggleChat: () => void, onToggleMusicPlayer: () => void }) {
    const { isMobile } = useSidebar();
    const params = useParams();
    const { toast } = useToast();

    const copyOverlayUrl = () => {
        const url = `${window.location.origin}/overlay/${params.roomId}`;
        navigator.clipboard.writeText(url);
        toast({
            title: "Overlay URL Copied!",
            description: "You can now paste this into your streaming software.",
        });
    }

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            <SidebarTrigger className={isMobile ? "" : "hidden md:flex"} />

            <div className="flex-1 flex items-center gap-4 truncate">
                <h2 className="text-xl font-bold font-headline truncate">{roomName}</h2>
                <ConnectionStatusIndicator />
            </div>

            <div className="flex flex-initial items-center justify-end space-x-2">
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
                        <Button variant="outline" size="icon" onClick={onToggleMusicPlayer}>
                            <Music className="h-5 w-5" />
                            <span className="sr-only">Toggle Music Player</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Toggle Music Player</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="outline" size="icon" onClick={onToggleChat}>
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
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [initialStateSet, setInitialStateSet] = useState(false);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);

  const roomRef = useMemoFirebase(() => {
      if (!firestore || !params.roomId) return null;
      return doc(firestore, 'rooms', params.roomId);
  }, [firestore, params.roomId]);

  const { data: room, isLoading: isRoomLoading } = useDoc<{ name: string, ownerId: string, isPlaying?: boolean }>(roomRef);

  useEffect(() => {
    if (initialStateSet || isRoomLoading || isUserLoading || !room || !user) {
      return;
    }
    const isHost = user.uid === room.ownerId;
    if (!isHost && room.isPlaying) {
      setMusicPlayerOpen(true);
    }
    setInitialStateSet(true);
  }, [initialStateSet, isRoomLoading, isUserLoading, room, user]);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !user.displayName || !firestore || !params.roomId) {
      return;
    }

    const userInRoomRef = doc(firestore, 'rooms', params.roomId, 'users', user.uid);
    const participantData = {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`,
        isMuted: false, 
        isSpeaking: false,
    };
    setDoc(userInRoomRef, participantData, { merge: true });

    (async () => {
      try {
        const metadataForToken = JSON.stringify({ photoURL: participantData.photoURL });
        const token = await generateLiveKitToken(params.roomId, user.uid, user.displayName!, metadataForToken);
        setLivekitToken(token);
      } catch (e: any) {
        console.error('[RoomPage] Failed to get LiveKit token', e);
        toast({
          variant: 'destructive',
          title: 'Voice Connection Failed',
          description: e.message || 'Could not generate an authentication token.',
        });
      }
    })();
    
    return () => {
      deleteDoc(userInRoomRef);
    };
  }, [user, isUserLoading, params.roomId, toast, firestore]);

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const { isMobile } = useSidebar();

  const isLoading = isUserLoading || isRoomLoading || !livekitToken || !livekitUrl;

  const renderLoadingState = () => (
      <div className="flex flex-col h-screen">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
              <SidebarTrigger className={isMobile ? "" : "hidden md:flex"} />
              <div className="flex-1 flex items-center gap-4 truncate">
                <h2 className="text-xl font-bold font-headline truncate">{room?.name || 'Loading room...'}</h2>
              </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-y-auto flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Connecting to voice...</p>
              </div>
          </main>
      </div>
  );
  
  const renderContent = () => (
    <LiveKitRoom
        serverUrl={livekitUrl!}
        token={livekitToken!}
        connect={true}
        audio={false}
        video={false}
        onError={(err) => {
            console.error("LiveKit connection error:", err);
            toast({
                variant: 'destructive',
                title: 'Connection Error',
                description: err.message,
            });
        }}
    >
        <RoomHeader
            roomName={room?.name || 'Loading room...'}
            onToggleChat={() => setChatOpen(!chatOpen)}
            onToggleMusicPlayer={() => setMusicPlayerOpen(!musicPlayerOpen)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <UserList musicPlayerOpen={musicPlayerOpen} roomId={params.roomId} />
        </main>
    </LiveKitRoom>
  );

  return (
    <>
        <LeftSidebar roomId={params.roomId} />
        <div className={cn(
          "bg-secondary/30 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width-icon)_+_1rem)] md:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width)_+_1rem)] duration-200 transition-[margin-left,margin-right]",
          chatOpen && "md:mr-[28rem]"
        )}>
            <SidebarInset>
                <div className="flex flex-col h-screen">
                  { isLoading ? renderLoadingState() : renderContent() }
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

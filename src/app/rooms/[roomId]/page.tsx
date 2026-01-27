
'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Copy, MessageSquare, X, Music } from 'lucide-react';
import LeftSidebar from '@/app/components/LeftSidebar';
import UserList from './_components/UserList';
import ChatBox from './_components/ChatBox';
import { rooms } from '@/lib/rooms';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";


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

            <h2 className="text-xl font-bold font-headline truncate flex-1">{roomName}</h2>

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

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const [chatOpen, setChatOpen] = useState(false);
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(true);
  const room = rooms.find(r => r.id === params.roomId) || rooms[0];

  return (
    <SidebarProvider>
        <LeftSidebar roomId={params.roomId} />
        <div className={cn(
          "bg-secondary/30 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width-icon)_+_1rem)] md:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width)_+_1rem)] duration-200 transition-[margin-left,margin-right]",
          chatOpen && "md:mr-[28rem]"
        )}>
            <SidebarInset>
                <div className="flex flex-col h-screen">
                    <RoomHeader 
                        roomName={room.name} 
                        onToggleChat={() => setChatOpen(!chatOpen)}
                        onToggleMusicPlayer={() => setMusicPlayerOpen(!musicPlayerOpen)}
                    />
                    <main className="flex-1 p-4 md:p-6 overflow-y-auto">
                        <UserList musicPlayerOpen={musicPlayerOpen} />
                    </main>
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
    </SidebarProvider>
  );
}

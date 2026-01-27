
'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Copy, MessageSquare } from 'lucide-react';
import LeftSidebar from '@/app/components/LeftSidebar';
import UserList from './_components/UserList';
import ChatBox from './_components/ChatBox';
import { rooms } from '@/lib/rooms';

function RoomHeader({ roomName, onToggleChat } : { roomName: string, onToggleChat: () => void }) {
    const { isMobile } = useSidebar();
    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            <SidebarTrigger className={isMobile ? "" : "hidden md:flex"} />

            <h2 className="text-xl font-bold font-headline truncate flex-1">{roomName}</h2>

            <div className="flex flex-initial items-center justify-end space-x-2">
                <Button variant="outline" size="sm" className='hidden sm:flex'>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Overlay URL
                </Button>
                <Button variant="outline" size="icon" onClick={onToggleChat}>
                    <MessageSquare className="h-5 w-5" />
                    <span className="sr-only">Toggle Chat</span>
                </Button>
            </div>
        </header>
    );
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const [chatOpen, setChatOpen] = useState(false);
  const room = rooms.find(r => r.id === params.roomId) || rooms[0];

  return (
    <SidebarProvider>
        <LeftSidebar roomId={params.roomId} />
        <div className="bg-secondary/30 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width-icon)_+_1rem)] md:peer-data-[variant=inset]:ml-[calc(var(--sidebar-width)_+_1rem)] duration-200 transition-[margin-left]">
            <SidebarInset>
                <div className="flex flex-col h-screen">
                    <RoomHeader roomName={room.name} onToggleChat={() => setChatOpen(true)} />
                    <main className="flex-1 p-4 md:p-6 overflow-y-auto">
                        <UserList />
                    </main>
                </div>
            </SidebarInset>
        </div>

        <Sheet open={chatOpen} onOpenChange={setChatOpen}>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col border-l">
                <ChatBox />
            </SheetContent>
        </Sheet>
    </SidebarProvider>
  );
}

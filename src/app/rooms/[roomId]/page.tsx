'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Copy, MessageSquare, Home, Music, PlusCircle, LogOut, Settings, User } from 'lucide-react';
import { Logo } from '@/app/components/Logo';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import UserList from './_components/UserList';
import ChatBox from './_components/ChatBox';

const rooms = [
  {
    id: '1',
    name: 'Lofi Beats to Study/Relax to',
    users: 12,
    nowPlaying: 'Golden Hour',
    isPublic: true,
  },
  {
    id: '2',
    name: 'Indie Pop & Chill',
    users: 8,
    nowPlaying: 'Clairo - Sofia',
    isPublic: true,
  },
  {
    id: '3',
    name: 'Throwback Jams  nostalgic',
    users: 25,
    nowPlaying: 'Rihanna - Don\'t Stop The Music',
    isPublic: true,
  },
  {
    id: '4',
    name: 'Gaming & Electronic',
    users: 5,
    nowPlaying: 'C418 - Sweden',
    isPublic: true,
  },
  {
    id: '5',
    name: 'Late Night Jazz',
    users: 3,
    nowPlaying: 'Miles Davis - So What',
    isPublic: false,
  },
  {
    id: '6',
    name: 'Rock Classics',
    users: 18,
    nowPlaying: 'Queen - Bohemian Rhapsody',
    isPublic: true,
  },
];


function LeftSidebar({ roomId }: { roomId: string }) {
  const publicRooms = rooms.filter(room => room.isPublic);
  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/">
                <Home />
                Home
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarGroup>
          <SidebarGroupLabel>Public Rooms</SidebarGroupLabel>
          <SidebarMenu>
            {publicRooms.map(room => (
              <SidebarMenuItem key={room.id}>
                <SidebarMenuButton asChild isActive={room.id === roomId}>
                  <Link href={`/rooms/${room.id}`}>
                    <Music />
                    {room.name}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className='gap-4'>
        <Button className='w-full'>
          <PlusCircle />
          Create Room
        </Button>
        <div className="border-t -mx-2"></div>
        <div className="flex items-center gap-3 p-2 rounded-md">
            <Avatar className="h-9 w-9">
                <AvatarImage src="https://picsum.photos/seed/301/100/100" alt="User Avatar" data-ai-hint="person portrait" />
                <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 overflow-hidden">
                <p className="text-sm font-medium leading-none truncate">Guest User</p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                    guest@hearmeout.com
                </p>
            </div>
        </div>
        <div className='flex gap-2'>
            <Button variant="outline" size="icon" className='flex-1'>
                <User/>
                <span className='sr-only'>Profile</span>
            </Button>
            <Button variant="outline" size="icon" className='flex-1'>
                <Settings/>
                <span className='sr-only'>Settings</span>
            </Button>
            <Button variant="outline" size="icon" asChild className='flex-1'>
                <Link href="/login" >
                    <LogOut />
                    <span className='sr-only'>Log in</span>
                </Link>
            </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

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

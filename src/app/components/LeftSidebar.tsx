
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Home, Music, PlusCircle, LogOut, Settings, User } from 'lucide-react';
import { Logo } from '@/app/components/Logo';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { rooms } from '@/lib/rooms';

export default function LeftSidebar({ roomId }: { roomId?: string }) {
  const pathname = usePathname();
  const publicRooms = rooms.filter(room => room.isPublic);

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/'}>
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
             <Button variant="outline" size="icon" asChild className='flex-1'>
                <Link href="/settings">
                    <Settings/>
                    <span className='sr-only'>Settings</span>
                </Link>
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

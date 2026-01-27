'use client';

import { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from "@/components/ui/scroll-area";
import { collection, query, where, or } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

interface Room {
    id: string;
    name: string;
    isPrivate: boolean;
}

interface MoveUserDialogProps {
  userToMove: { id: string; name: string; };
  currentRoomId: string;
  onMoveUser: (targetRoomId: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function MoveUserDialog({ userToMove, currentRoomId, onMoveUser, onOpenChange }: MoveUserDialogProps) {
  const { firestore, user } = useFirebase();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Query for rooms that are public OR private rooms owned by the current user
  const roomsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'rooms'),
      or(
          where('isPrivate', '==', false),
          where('ownerId', '==', user.uid)
      )
    );
  }, [firestore, user]);

  const { data: rooms, isLoading: roomsLoading } = useCollection<Room>(roomsQuery);

  const availableRooms = rooms?.filter(room => room.id !== currentRoomId);

  const handleMove = () => {
    if (selectedRoomId) {
      onMoveUser(selectedRoomId);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {userToMove.name}</DialogTitle>
          <DialogDescription>
            Select a room to move the user to. This will bypass private room restrictions.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                    {roomsLoading && <Skeleton className="h-8 w-full" />}
                    {availableRooms && availableRooms.length > 0 ? (
                        availableRooms.map(room => (
                            <div
                                key={room.id}
                                onClick={() => setSelectedRoomId(room.id)}
                                className={cn(
                                    "flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors hover:bg-accent",
                                    selectedRoomId === room.id && "bg-accent"
                                )}
                            >
                                <span>{room.name} {room.isPrivate && '(Private)'}</span>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-sm text-muted-foreground p-4">No other rooms available.</p>
                    )}
                </div>
            </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleMove} disabled={!selectedRoomId}>
            Move User <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, Music } from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";
import { cn } from "@/lib/utils";

export type PlaylistItem = {
  id: string;
  title: string;
  artist: string;
  artId: string;
  url: string;
};

export default function Playlist({ playlist, onPlaySong, currentTrackId, isPlayerControlAllowed }: { playlist: PlaylistItem[], onPlaySong: (songId: string) => void, currentTrackId: string, isPlayerControlAllowed: boolean }) {
  
  if (!playlist || playlist.length === 0) {
    return (
        <div className="h-64 w-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Playlist is empty.</p>
        </div>
    )
  }

  return (
    <ScrollArea className="h-64 w-full">
      <ul className="space-y-1 p-2">
        {playlist.map((item) => {
          const art = placeholderData.placeholderImages.find(p => p.id === item.artId);
          const isPlaying = item.id === currentTrackId;

          return (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md transition-colors",
                isPlayerControlAllowed && "cursor-pointer hover:bg-secondary",
                isPlaying && "bg-secondary font-semibold"
              )}
              onClick={() => isPlayerControlAllowed && onPlaySong(item.id)}
            >
              {isPlayerControlAllowed && <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />}
              {art && 
                <Image
                    src={art.imageUrl}
                    alt={item.title}
                    width={40}
                    height={40}
                    className="rounded-md"
                    data-ai-hint={art.imageHint}
                />
              }
              <div className="flex-1 overflow-hidden">
                <p className="truncate">{item.title}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {item.artist}
                </p>
              </div>
              {isPlaying && <Music className="h-5 w-5 text-primary" />}
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}

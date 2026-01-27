import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, Music } from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";
import { cn } from "@/lib/utils";

export type PlaylistItem = {
  id: number;
  title: string;
  artist: string;
  artId: string;
  url: string;
};

export default function Playlist({ playlist, onPlaySong, currentTrackId }: { playlist: PlaylistItem[], onPlaySong: (index: number) => void, currentTrackId: number }) {
  return (
    <ScrollArea className="h-64 w-full">
      <ul className="space-y-1 p-2">
        {playlist.map((item, index) => {
          const art = placeholderData.placeholderImages.find(p => p.id === item.artId);
          const isPlaying = item.id === currentTrackId;

          return (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md hover:bg-secondary transition-colors cursor-pointer",
                isPlaying && "bg-secondary font-semibold"
              )}
              onClick={() => onPlaySong(index)}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
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

import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical } from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";

const playlistItems = [
  { id: 1, title: "Sofia", artist: "Clairo", artId: "album-art-2" },
  { id: 2, title: "Sweden", artist: "C418", artId: "album-art-3" },
  { id: 3, title: "Don't Stop The Music", artist: "Rihanna", artId: "album-art-1" },
  { id: 4, title: "So What", artist: "Miles Davis", artId: "album-art-2" },
];

export default function Playlist() {
  return (
    <Card className="flex-1 flex flex-col min-h-0">
      <CardHeader>
        <CardTitle className="font-headline">Up Next</CardTitle>
        <CardDescription>Drag to reorder</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <ul className="space-y-1 p-2">
            {playlistItems.map((item) => {
              const art = placeholderData.placeholderImages.find(p => p.id === item.artId);
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary transition-colors cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
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
                    <p className="font-semibold truncate">{item.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.artist}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

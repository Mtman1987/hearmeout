import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Youtube,
  Upload,
} from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";

export default function MusicPlayer() {
  const albumArt = placeholderData.placeholderImages.find(p => p.id === "album-art-1");

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-center">
        {albumArt &&
            <Image
                src={albumArt.imageUrl}
                alt="Album Art"
                width={150}
                height={150}
                className="rounded-lg shadow-lg object-cover aspect-square"
                data-ai-hint={albumArt.imageHint}
            />
        }
        <div className="flex-1 w-full">
          <div className="text-center sm:text-left">
            <h3 className="text-2xl font-bold font-headline">Golden Hour</h3>
            <p className="text-muted-foreground">JVKE</p>
          </div>
          <div className="mt-4 space-y-2">
            <Slider defaultValue={[33]} max={100} step={1} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1:02</span>
              <span>3:29</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon">
              <SkipBack />
            </Button>
            <Button size="lg" className="h-14 w-14 rounded-full">
              <Pause className="h-6 w-6" />
            </Button>
            <Button variant="ghost" size="icon">
              <SkipForward />
            </Button>
          </div>
        </div>
        <div className="flex sm:flex-col items-center justify-center gap-2">
            <Volume2 className="text-muted-foreground" />
            <Slider 
                orientation="vertical" 
                defaultValue={[50]} 
                max={100} 
                step={1} 
                className="h-24 w-2 sm:h-24 sm:w-auto"
            />
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 p-4 flex gap-2">
        <div className="relative flex-grow">
            <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Add YouTube URL" className="pl-10" />
        </div>
        <Button variant="outline">Add</Button>
        <Button variant="outline" size="icon">
            <Upload className="h-5 w-5" />
            <span className="sr-only">Upload Audio</span>
        </Button>
      </CardFooter>
    </Card>
  );
}

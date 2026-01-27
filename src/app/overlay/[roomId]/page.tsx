import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { Music, Mic } from "lucide-react";
import placeholderData from "@/lib/placeholder-images.json";

export default function OverlayPage({ params }: { params: { roomId: string } }) {
  const albumArt = placeholderData.placeholderImages.find(p => p.id === "album-art-1");
  const speakerAvatar = placeholderData.placeholderImages.find(p => p.id === "avatar-1");

  return (
    <div className="min-h-screen bg-transparent text-white p-4 flex flex-col justify-end">
      <div className="w-full max-w-md ml-auto rounded-lg bg-black/50 backdrop-blur-md p-4 shadow-2xl animate-in fade-in-50 slide-in-from-bottom-5 duration-500">
        <div className="flex items-center gap-4">
          <div className="relative">
            {albumArt && (
              <Image
                src={albumArt.imageUrl}
                alt="Album Art"
                width={80}
                height={80}
                className="rounded-md"
                data-ai-hint={albumArt.imageHint}
              />
            )}
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <Music className="w-8 h-8 text-white/80" />
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm text-gray-300">Now Playing</p>
            <h2 className="text-lg font-bold truncate">Golden Hour</h2>
            <p className="text-sm text-gray-400 truncate">JVKE</p>
          </div>
        </div>
        <div className="border-t border-white/10 my-3"></div>
        <div className="flex items-center gap-3">
          <div className="relative">
            {speakerAvatar && (
                 <Avatar>
                    <AvatarImage src={speakerAvatar.imageUrl} alt="Current Speaker" data-ai-hint={speakerAvatar.imageHint} />
                    <AvatarFallback>S</AvatarFallback>
                </Avatar>
            )}
            <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-black/50">
                <Mic className="w-3 h-3 text-white" />
            </div>
          </div>
           <div>
            <p className="text-sm text-gray-300">Speaking</p>
            <p className="font-semibold">Sarah</p>
           </div>
        </div>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import Header from "@/app/components/Header";
import { Copy } from "lucide-react";
import MusicPlayer from "./_components/MusicPlayer";
import UserList from "./_components/UserList";
import Playlist from "./_components/Playlist";
import ChatBox from "./_components/ChatBox";

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return (
    <div className="flex flex-col h-screen bg-secondary">
      <Header />
      <main className="flex-1 container mx-auto py-6 px-4 overflow-hidden">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold font-headline">Lofi Beats to Study/Relax to</h2>
            <Button variant="outline" size="sm">
                <Copy className="mr-2 h-4 w-4" />
                Copy Overlay URL
            </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100%-4rem)]">
          <div className="lg:col-span-1 flex flex-col gap-6 h-full">
            <UserList />
            <Playlist />
          </div>
          <div className="lg:col-span-3 flex flex-col gap-6 h-full">
            <MusicPlayer />
            <ChatBox />
          </div>
        </div>
      </main>
    </div>
  );
}

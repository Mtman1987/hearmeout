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
      <main className="flex-1 container mx-auto py-6 px-4 flex flex-col gap-6 overflow-hidden">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold font-headline">Lofi Beats to Study/Relax to</h2>
            <Button variant="outline" size="sm">
                <Copy className="mr-2 h-4 w-4" />
                Copy Overlay URL
            </Button>
        </div>
        
        <MusicPlayer />
        
        <div className="flex-1 overflow-y-auto pb-4 pr-2 -mr-2">
          <UserList />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px] min-h-[400px] pb-4">
          <Playlist />
          <ChatBox />
        </div>

      </main>
    </div>
  );
}

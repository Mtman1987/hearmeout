import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Music } from "lucide-react";
import Header from "@/app/components/Header";

const rooms = [
  {
    id: "1",
    name: "Lofi Beats to Study/Relax to",
    users: 12,
    nowPlaying: "Golden Hour",
    isPublic: true,
  },
  {
    id: "2",
    name: "Indie Pop & Chill",
    users: 8,
    nowPlaying: "Clairo - Sofia",
    isPublic: true,
  },
  {
    id: "3",
    name: "Throwback Jams  nostalgic",
    users: 25,
    nowPlaying: "Rihanna - Don't Stop The Music",
    isPublic: true,
  },
  {
    id: "4",
    name: "Gaming & Electronic",
    users: 5,
    nowPlaying: "C418 - Sweden",
    isPublic: true,
  },
  {
    id: "5",
    name: "Late Night Jazz",
    users: 3,
    nowPlaying: "Miles Davis - So What",
    isPublic: false,
  },
  {
    id: "6",
    name: "Rock Classics",
    users: 18,
    nowPlaying: "Queen - Bohemian Rhapsody",
    isPublic: true,
  },
];

export default function Home() {
  const publicRooms = rooms.filter(room => room.isPublic);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-8 px-4">
        <h2 className="text-3xl font-bold font-headline mb-6 text-foreground">
          Public Rooms
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publicRooms.map((room) => (
            <Card key={room.id} className="flex flex-col hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-headline">{room.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 pt-2">
                  <Users className="h-4 w-4" />
                  <span>{room.users} listeners</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Music className="h-4 w-4" />
                  <span>Now Playing: {room.nowPlaying}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/rooms/${room.id}`}>Join Room</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} HearMeOut. All rights reserved.
      </footer>
    </div>
  );
}

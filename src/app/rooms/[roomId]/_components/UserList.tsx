import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import placeholderData from "@/lib/placeholder-images.json";
import { Mic } from "lucide-react";

const users = [
  { id: 1, name: "Sarah", avatarId: "avatar-1", isSpeaking: true },
  { id: 2, name: "Mike", avatarId: "avatar-2", isSpeaking: false },
  { id: 3, name: "You", avatarId: "avatar-3", isSpeaking: false },
  { id: 4, name: "David", avatarId: "avatar-4", isSpeaking: false },
  { id: 5, name: "Chloe", avatarId: "avatar-1", isSpeaking: false },
  { id: 6, name: "Alex", avatarId: "avatar-2", isSpeaking: false },
];

export default function UserList() {
  return (
    <Card className="flex-1 flex flex-col max-h-64 lg:max-h-none min-h-0">
      <CardHeader>
        <CardTitle className="font-headline">Listeners</CardTitle>
        <CardDescription>{users.length} people in this room</CardDescription>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
            <ul className="space-y-1 p-2">
                {users.map((user) => {
                    const avatar = placeholderData.placeholderImages.find(p => p.id === user.avatarId);
                    return (
                        <li key={user.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary transition-colors">
                            <div className="relative">
                                <Avatar>
                                    {avatar && <AvatarImage src={avatar.imageUrl} alt={user.name} data-ai-hint={avatar.imageHint} />}
                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {user.isSpeaking && (
                                    <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-card">
                                        <Mic className="h-3 w-3 text-white" />
                                    </div>
                                )}
                            </div>
                            <span className="font-medium">{user.name}</span>
                        </li>
                    );
                })}
            </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

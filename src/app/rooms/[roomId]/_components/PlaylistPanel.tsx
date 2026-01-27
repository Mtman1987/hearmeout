'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Playlist, { type PlaylistItem } from "./Playlist";
import { ListMusic } from "lucide-react";

type PlaylistPanelProps = {
    playlist: PlaylistItem[];
    onPlaySong: (songId: string) => void;
    currentTrackId: string;
    isHost: boolean;
}

export default function PlaylistPanel({ playlist, onPlaySong, currentTrackId, isHost }: PlaylistPanelProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <ListMusic /> Up Next
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Playlist playlist={playlist} onPlaySong={onPlaySong} currentTrackId={currentTrackId} isHost={isHost} />
            </CardContent>
        </Card>
    )
}

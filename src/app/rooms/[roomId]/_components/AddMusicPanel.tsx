'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Youtube, Upload, LoaderCircle } from "lucide-react";
import type { PlaylistItem } from "./Playlist";
import { getYoutubeInfo } from '@/app/actions';

type AddMusicPanelProps = {
    onAddItems: (items: PlaylistItem[]) => void;
    onClose: () => void;
    isHost: boolean;
};

export default function AddMusicPanel({ onAddItems, onClose, isHost }: AddMusicPanelProps) {
    const [inputValue, setInputValue] = useState("");
    const [isFetching, setIsFetching] = useState(false);

    const handleAddUrl = async () => {
        if (!inputValue.trim() || isFetching || !isHost) return;

        setIsFetching(true);
        const newItems = await getYoutubeInfo(inputValue);
        setIsFetching(false);

        if (newItems && newItems.length > 0) {
            onAddItems(newItems);
            setInputValue("");
            onClose();
        }
    };

    if (!isHost) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <Youtube /> Add Music
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className='p-4 text-sm text-muted-foreground'>Only the room host can add music to the playlist.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <Youtube /> Add Music
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="p-4 flex gap-2">
                    <div className="relative flex-grow">
                        <Input
                            placeholder="Add YouTube URL"
                            className="pl-4"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddUrl();
                                }
                            }}
                            disabled={isFetching}
                        />
                    </div>
                    <Button variant="outline" onClick={handleAddUrl} disabled={isFetching}>
                        {isFetching ? <LoaderCircle className="animate-spin" /> : 'Add'}
                    </Button>
                    <Button variant="outline" size="icon" disabled>
                        <Upload />
                        <span className="sr-only">Upload Audio</span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

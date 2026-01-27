'use client';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export const SpeakingIndicator = ({ isSpeaking }: { isSpeaking: boolean }) => {
    const [level, setLevel] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isSpeaking) {
            interval = setInterval(() => {
                // Simulate audio level changes
                setLevel(0.2 + Math.random() * 0.8);
            }, 150);
        } else {
            setLevel(0);
        }
        return () => clearInterval(interval);
    }, [isSpeaking]);

    return (
        <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
            <div
                className={cn(
                    "h-full bg-primary transition-all duration-100",
                )}
                style={{ width: `${level * 100}%` }}
            />
        </div>
    );
};

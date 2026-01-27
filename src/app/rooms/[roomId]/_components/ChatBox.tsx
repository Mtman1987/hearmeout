"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Send, Info, ShieldAlert, Smile, Frown, Meh } from "lucide-react";
import { runModeration } from "@/app/actions";
import type { ModerateContentOutput } from "@/ai/flows/sentiment-based-moderation";

export default function ChatBox() {
  const [messages, setMessages] = useState<string[]>([
    "Sarah: Hey everyone! Ready for some chill music?",
    "Mike: Absolutely! Let's get this study session started.",
  ]);
  const [input, setInput] = useState("");
  const [moderationResult, setModerationResult] = useState<ModerateContentOutput | null>(null);
  const [isPending, setIsPending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isPending) return;

    const newMessage = `You: ${input.trim()}`;
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsPending(true);

    const conversationHistory = updatedMessages.join("\n");
    const result = await runModeration(conversationHistory);
    
    setModerationResult(result);
    setIsPending(false);
  };
  
  const SentimentIcon = () => {
    if (!moderationResult) return <Info className="h-4 w-4" />;
    if (moderationResult.isHarmful) return <ShieldAlert className="h-4 w-4" />;
    const sentiment = moderationResult.overallSentiment.toLowerCase();
    if (sentiment.includes("positive")) return <Smile className="h-4 w-4" />;
    if (sentiment.includes("negative")) return <Frown className="h-4 w-4" />;
    return <Meh className="h-4 w-4" />;
  }

  return (
    <Card className="flex flex-col flex-1 min-h-0">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          Chat & Moderation
        </CardTitle>
        <CardDescription>
          Conversation is monitored for safety.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <p key={index} className="text-sm">
                <span className="font-bold text-primary mr-2">
                  {msg.split(":")[0]}:
                </span>
                {msg.split(":").slice(1).join(":")}
              </p>
            ))}
          </div>
        </ScrollArea>
        {moderationResult && (
            <Alert variant={moderationResult.isHarmful ? "destructive" : "default"}>
                <SentimentIcon />
                <AlertTitle className="font-headline">
                    {moderationResult.isHarmful ? 'Harmful Content Detected' : 'Sentiment Analysis'}
                </AlertTitle>
                <AlertDescription>
                    {moderationResult.isHarmful 
                        ? moderationResult.alertReason 
                        : `Overall sentiment: ${moderationResult.overallSentiment}`
                    }
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
          <Textarea
            placeholder="Type your message here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={isPending || !input.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

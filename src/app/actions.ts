"use server";

import { moderateContent } from "@/ai/flows/sentiment-based-moderation";
import type { ModerateContentOutput } from "@/ai/flows/sentiment-based-moderation";
import { getYoutubeInfo as getYoutubeInfoFlow } from "@/ai/flows/get-youtube-info-flow";
import type { PlaylistItem } from "@/app/rooms/[roomId]/_components/Playlist";

export async function runModeration(
  conversationHistory: string
): Promise<ModerateContentOutput> {
  try {
    const result = await moderateContent({ conversationHistory });
    return result;
  } catch (error) {
    console.error("Error running moderation:", error);
    return {
      overallSentiment: "Error",
      isHarmful: true,
      alertReason: "Failed to analyze content.",
    };
  }
}

export async function getYoutubeInfo(url: string): Promise<PlaylistItem[] | null> {
  try {
    const result = await getYoutubeInfoFlow({ url });
    return result;
  } catch (error) {
    console.error("Error getting YouTube info:", error);
    return null;
  }
}

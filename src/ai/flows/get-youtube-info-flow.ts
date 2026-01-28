'use server';
/**
 * @fileOverview A flow to fetch information about YouTube videos and playlists.
 *
 * - getYoutubeInfo - A function that fetches data for a given YouTube URL.
 * - GetYoutubeInfoInput - The input type for the getYoutubeInfo function.
 * - GetYoutubeInfoOutput - The return type for the getYoutubeInfo function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { YouTube } from 'youtube-sr';

const GetYoutubeInfoInputSchema = z.object({
  url: z.string().describe('The YouTube URL for a video or playlist.'),
});
export type GetYoutubeInfoInput = z.infer<typeof GetYoutubeInfoInputSchema>;

const PlaylistItemSchema = z.object({
    id: z.string(),
    title: z.string(),
    artist: z.string(),
    artId: z.string(),
    url: z.string(),
    duration: z.number(),
});

export type PlaylistItem = z.infer<typeof PlaylistItemSchema>;

const GetYoutubeInfoOutputSchema = z.array(PlaylistItemSchema);
export type GetYoutubeInfoOutput = z.infer<typeof GetYoutubeInfoOutputSchema>;


export async function getYoutubeInfo(input: GetYoutubeInfoInput): Promise<GetYoutubeInfoOutput> {
  return getYoutubeInfoFlow(input);
}

// A simple deterministic hash function to select album art
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function selectArtId(videoId: string): string {
    const artIds = ["album-art-1", "album-art-2", "album-art-3"];
    if (!videoId) {
        return artIds[0];
    }
    const hash = simpleHash(videoId);
    return artIds[hash % artIds.length];
}

const getYoutubeInfoFlow = ai.defineFlow(
  {
    name: 'getYoutubeInfoFlow',
    inputSchema: GetYoutubeInfoInputSchema,
    outputSchema: GetYoutubeInfoOutputSchema,
  },
  async (input) => {
    try {
      if (YouTube.isPlaylist(input.url)) {
        const playlist = await YouTube.getPlaylist(input.url, { fetchAll: true });
        if (!playlist || playlist.videos.length === 0) return [];
        
        return playlist.videos
          .filter(video => video.id && video.title && video.duration)
          .map((video): PlaylistItem => {
            return {
              id: video.id!,
              title: video.title!,
              artist: video.channel?.name || 'Unknown Artist',
              url: video.url,
              artId: selectArtId(video.id!),
              duration: video.duration / 1000, 
            };
          });

      } else {
        const isUrl = YouTube.isYouTube(input.url, {checkVideo: true});
        const video = isUrl ? await YouTube.getVideo(input.url) : (await YouTube.search(input.url, { limit: 1, type: 'video' }))[0];

        if (!video || !video.id || !video.title || !video.duration) {
            throw new Error(`Could not find a valid video for "${input.url}"`);
        }
        
        return [{
          id: video.id,
          title: video.title,
          artist: video.channel?.name || 'Unknown Artist',
          url: video.url,
          artId: selectArtId(video.id),
          duration: video.duration / 1000,
        }];
      }
    } catch (error) {
      console.error('Failed to fetch YouTube data:', error);
      // This is where you would call your URL ripping API and upload to a storage bucket.
      // For now, we'll throw an error to indicate that the operation failed.
      throw new Error('Could not fetch video or playlist data from YouTube.');
    }
  }
);

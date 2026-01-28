'use server';
/**
 * @fileOverview A flow to fetch information about YouTube videos and return playable stream URLs from an external conversion service.
 *
 * - getYoutubeInfo - A function that handles the entire process.
 * - GetYoutubeInfoInput - The input type for the getYoutubeInfo function.
 * - GetYoutubeInfoOutput - The return type for the getYoutubeInfo function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { PlaylistItem } from '@/types/playlist';
import { YouTube } from 'youtube-sr';

// --- Types and Schemas ---

const GetYoutubeInfoInputSchema = z.object({
  url: z.string().describe('The YouTube URL or search query for a video or playlist.'),
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

const GetYoutubeInfoOutputSchema = z.array(PlaylistItemSchema);
export type GetYoutubeInfoOutput = z.infer<typeof GetYoutubeInfoOutputSchema>;


// --- Main exported function ---

export async function getYoutubeInfo(
  input: GetYoutubeInfoInput
): Promise<GetYoutubeInfoOutput> {
  return getYoutubeInfoFlow(input);
}


// --- Helper Functions ---

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function selectArtId(videoId: string): string {
  const artIds = ['album-art-1', 'album-art-2', 'album-art-3'];
  if (!videoId) return artIds[0];
  const hash = simpleHash(videoId);
  return artIds[hash % artIds.length];
}


// --- Genkit Flow ---

const getYoutubeInfoFlow = ai.defineFlow(
  {
    name: 'getYoutubeInfoFlow',
    inputSchema: GetYoutubeInfoInputSchema,
    outputSchema: GetYoutubeInfoOutputSchema,
  },
  async (input) => {
    try {
        const isUrl = YouTube.isYouTube(input.url, { checkVideo: true, checkPlaylist: true });
        let videos: any[] = [];

        if (isUrl) {
            if (YouTube.isPlaylist(input.url)) {
                const playlist = await YouTube.getPlaylist(input.url);
                if (!playlist || playlist.videos.length === 0) {
                    throw new Error(`I couldn't find that playlist or it's empty.`);
                }
                videos = playlist.videos;
            } else {
                const video = await YouTube.getVideo(input.url);
                if (!video) {
                    throw new Error(`I couldn't find a video at that URL.`);
                }
                videos.push(video);
            }
        } else {
            const searchResults = await YouTube.search(input.url, { limit: 1, type: 'video' });
            if (!searchResults || searchResults.length === 0) {
                throw new Error(`I couldn't find any songs matching "${input.url}".`);
            }
            videos.push(searchResults[0]);
        }
        
        if (videos.length === 0) {
            throw new Error(`I couldn't find any songs for "${input.url}".`);
        }

        // Map the results to our playlist item format
        const playlistItems: PlaylistItem[] = videos
            .filter(video => video && video.id) // Ensure video and video.id are not null
            .map((video) => {
                const originalUrl = `https://www.youtube.com/watch?v=${video.id}`;
                const streamUrl = `https://convert2mp3s.com/api/single/mp3?url=${encodeURIComponent(originalUrl)}`;

                return {
                    id: video.id!,
                    title: video.title || 'Unknown Title',
                    artist: video.channel?.name || 'Unknown Artist',
                    artId: selectArtId(video.id!),
                    url: streamUrl,
                    duration: (video.duration || 0) / 1000,
                };
            });

        return playlistItems;

    } catch (error) {
      console.error('An error occurred in the getYoutubeInfoFlow:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to process request: ${error.message}`);
      }
      throw new Error('An unknown error occurred while fetching song info.');
    }
  }
);

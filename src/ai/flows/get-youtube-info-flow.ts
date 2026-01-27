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
import { PlaylistItem } from '@/app/rooms/[roomId]/_components/Playlist';

const GetYoutubeInfoInputSchema = z.object({
  url: z.string().url().describe('The YouTube URL for a video or playlist.'),
});
export type GetYoutubeInfoInput = z.infer<typeof GetYoutubeInfoInputSchema>;

const PlaylistItemSchema = z.object({
    id: z.string(),
    title: z.string(),
    artist: z.string(),
    artId: z.string(),
    url: z.string(),
});

const GetYoutubeInfoOutputSchema = z.array(PlaylistItemSchema);
export type GetYoutubeInfoOutput = z.infer<typeof GetYoutubeInfoOutputSchema>;


export async function getYoutubeInfo(input: GetYoutubeInfoInput): Promise<GetYoutubeInfoOutput> {
  return getYoutubeInfoFlow(input);
}

function selectRandomArtId(): string {
    const artIds = ["album-art-1", "album-art-2", "album-art-3"];
    return artIds[Math.floor(Math.random() * artIds.length)];
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
        
        return playlist.videos.map((video): PlaylistItem => ({
          id: video.id!,
          title: video.title || 'Untitled',
          artist: video.channel?.name || 'Unknown Artist',
          url: video.url,
          artId: selectRandomArtId(),
        }));

      } else {
        const video = await YouTube.getVideo(input.url);
        if (!video) return [];

        return [{
          id: video.id!,
          title: video.title || 'Untitled',
          artist: video.channel?.name || 'Unknown Artist',
          url: video.url,
          artId: selectRandomArtId(),
        }];
      }
    } catch (error) {
      console.error('Failed to fetch YouTube data:', error);
      throw new Error('Could not fetch video or playlist data from YouTube.');
    }
  }
);

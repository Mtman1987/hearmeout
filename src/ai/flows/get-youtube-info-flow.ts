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
import ytdl from 'ytdl-core';
import { PlaylistItem } from '@/app/rooms/[roomId]/_components/Playlist';

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
        
        // Note: duration from youtube-sr on playlist items can be unreliable.
        return playlist.videos
            .filter(video => video.id)
            .map((video): PlaylistItem => ({
              id: video.id!,
              title: video.title || 'Untitled',
              artist: video.channel?.name || 'Unknown Artist',
              url: video.url,
              artId: selectArtId(video.id!),
              // duration is in ms, convert to seconds. Fallback to 0 if not present.
              duration: video.duration ? video.duration / 1000 : 0, 
            }));

      } else if (ytdl.validateURL(input.url)) {
        const info = await ytdl.getInfo(input.url);
        const videoDetails = info.videoDetails;

        return [{
          id: videoDetails.videoId,
          title: videoDetails.title,
          artist: videoDetails.author.name,
          url: videoDetails.video_url,
          artId: selectArtId(videoDetails.videoId),
          duration: parseInt(videoDetails.lengthSeconds, 10),
        }];
      } else {
        // Fallback to youtube-sr for general search if not a valid URL for ytdl
         const searchResults = await YouTube.search(input.url, { limit: 1, type: 'video' });
         if (!searchResults || searchResults.length === 0 || !searchResults[0].id) {
             return [];
         }
         const video = searchResults[0];
         // Get more detailed info using ytdl to ensure duration is correct
         const info = await ytdl.getInfo(video.url);
         const videoDetails = info.videoDetails;
         return [{
            id: video.id!,
            title: videoDetails.title,
            artist: videoDetails.author.name,
            url: videoDetails.video_url,
            artId: selectArtId(video.id!),
            duration: parseInt(videoDetails.lengthSeconds, 10),
         }];
      }
    } catch (error) {
      console.error('Failed to fetch YouTube data:', error);
      // Fallback to a simpler search if ytdl fails for any reason
       try {
        const searchResults = await YouTube.search(input.url, { limit: 1, type: 'video' });
        if (!searchResults || searchResults.length === 0 || !searchResults[0].id) {
             throw new Error('Could not fetch video or playlist data from YouTube.');
        }
        const video = searchResults[0];
        return [{
            id: video.id!,
            title: video.title || "Unknown Title",
            artist: video.channel?.name || "Unknown Artist",
            url: video.url,
            artId: selectArtId(video.id!),
            duration: video.duration ? video.duration / 1000 : 0
        }]
       } catch (searchError) {
            console.error('Fallback YouTube search failed:', searchError);
            throw new Error('Could not fetch video or playlist data from YouTube.');
       }
    }
  }
);

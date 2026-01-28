'use server';
/**
 * @fileOverview A flow to fetch information about YouTube videos and playlists.
 *
 * - getYoutubeInfo - A function that fetches data for a given YouTube URL or search query.
 * - GetYoutubeInfoInput - The input type for the getYoutubeInfo function.
 * - GetYoutubeInfoOutput - The return type for the getYoutubeInfo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { PlaylistItem } from '@/types/playlist';
import { google } from 'googleapis';

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
  const artIds = ['album-art-1', 'album-art-2', 'album-art-3'];
  if (!videoId) return artIds[0];
  const hash = simpleHash(videoId);
  return artIds[hash % artIds.length];
}

function parseYouTubeVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function parseYouTubePlaylistId(url: string): string | null {
    const regex = /[?&]list=([^#&?]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// --- Genkit Flow Definition ---

const getYoutubeInfoFlow = ai.defineFlow(
  {
    name: 'getYoutubeInfoFlow',
    inputSchema: GetYoutubeInfoInputSchema,
    outputSchema: GetYoutubeInfoOutputSchema,
  },
  async (input) => {
    try {
        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
        
        if (!YOUTUBE_API_KEY) {
            throw new Error('YouTube API key is not configured on the server. Please add YOUTUBE_API_KEY to your .env file.');
        }

        const youtube = google.youtube({
            version: 'v3',
            auth: YOUTUBE_API_KEY
        });
        
        const playlistId = parseYouTubePlaylistId(input.url);
        const videoId = parseYouTubeVideoId(input.url);

        let videoIds: string[] = [];

        if (playlistId) {
            const playlistResponse = await youtube.playlistItems.list({
                part: ['contentDetails'],
                playlistId: playlistId,
                maxResults: 50 // YouTube API max is 50 per page
            });

            const items = playlistResponse.data.items;
            if (!items || items.length === 0) {
                throw new Error("Could not find that playlist or it's empty.");
            }
            videoIds = items.map(item => item.contentDetails?.videoId).filter((id): id is string => !!id);

        } else if (videoId) {
            videoIds.push(videoId);

        } else {
            const searchResponse = await youtube.search.list({
                part: ['snippet'],
                q: input.url,
                maxResults: 1,
                type: ['video'],
                videoCategoryId: '10' // Official YouTube ID for the "Music" category
            });

            if (!searchResponse.data.items || searchResponse.data.items.length === 0 || !searchResponse.data.items[0].id?.videoId) {
                 throw new Error(`No music video found for query: "${input.url}". Please try a more specific search.`);
            }

            videoIds.push(searchResponse.data.items[0].id.videoId);
        }

        if (videoIds.length === 0) {
             throw new Error('No videos found to process.');
        }

        // Get details for all video IDs
        const videoDetailsResponse = await youtube.videos.list({
            part: ['snippet', 'contentDetails'],
            id: videoIds
        });

        if (!videoDetailsResponse.data.items || videoDetailsResponse.data.items.length === 0) {
            throw new Error('Could not fetch video details.');
        }

        const parseDuration = (duration: string): number => {
            const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
            if (!match) return 0;
            const hours = (parseInt(match[1]) || 0);
            const minutes = (parseInt(match[2]) || 0);
            const seconds = (parseInt(match[3]) || 0);
            return hours * 3600 + minutes * 60 + seconds;
        };

        const results: PlaylistItem[] = videoDetailsResponse.data.items.map(item => ({
            id: item.id!,
            title: item.snippet?.title || 'Unknown Title',
            artist: item.snippet?.channelTitle || 'Unknown Artist',
            artId: selectArtId(item.id!),
            url: `https://www.youtube.com/watch?v=${item.id}`,
            duration: item.contentDetails?.duration ? parseDuration(item.contentDetails.duration) : 0,
        }));

        return results;

    } catch (error) {
        console.error('An error occurred in the getYoutubeInfoFlow:', error);
        if (error instanceof Error) {
            if (error.message.includes('API key not valid')) {
                throw new Error('The YouTube API key is invalid. Please check the server configuration.');
            }
            if ((error as any).response?.data?.error?.message) {
                throw new Error(`YouTube API Error: ${(error as any).response.data.error.message}`);
            }
            throw new Error(error.message || 'Failed to process song request.');
        }
        throw new Error('An unknown error occurred while processing the song request.');
    }
  }
);

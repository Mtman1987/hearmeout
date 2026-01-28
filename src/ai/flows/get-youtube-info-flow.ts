'use server';
/**
 * @fileOverview A flow to fetch information about YouTube videos, trigger a download via an external service, and return playable URLs.
 *
 * - getYoutubeInfo - A function that handles the entire process.
 * - GetYoutubeInfoInput - The input type for the getYoutubeInfo function.
 * - GetYoutubeInfoOutput - The return type for the getYoutubeInfo function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
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

const parseYouTubeVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
};


// --- RapidAPI Helper Functions ---

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'yt-downloader9.p.rapidapi.com';

async function startDownloadJob(youtubeUrl: string): Promise<string> {
    const response = await fetch(`https://${RAPIDAPI_HOST}/start`, {
        method: 'POST',
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY!,
            'x-rapidapi-host': RAPIDAPI_HOST,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            urls: [youtubeUrl],
            onlyAudio: true,
            ignorePlaylists: false, // We want to process playlists
            videoQuality: 'best'
        })
    });
    const data = await response.json();
    if (!response.ok || !data.jobId) {
        console.error("RapidAPI /start error:", data);
        throw new Error(`Failed to start download job on RapidAPI. ${data.message || ''}`);
    }
    return data.jobId;
}

async function pollJobStatus(jobId: string) {
    const MAX_POLLS = 36; // 36 polls * 5 seconds = 180 seconds (3 minutes)
    const POLL_INTERVAL = 5000; // 5 seconds

    for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

        const response = await fetch(`https://${RAPIDAPI_HOST}/status?jobId=${jobId}`, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY!,
                'x-rapidapi-host': RAPIDAPI_HOST,
            }
        });
        
        if (!response.ok) {
            console.warn(`Polling failed for job ${jobId}, status ${response.status}. Retrying...`);
            continue;
        }
        
        const data = await response.json();

        if (data.status === 'finished') {
            return data;
        } else if (data.status === 'failed') {
            throw new Error(`RapidAPI job ${jobId} failed: ${data.error || 'Unknown reason'}`);
        }
    }

    throw new Error('Song conversion timed out after 3 minutes. The video may be too long or the service is busy.');
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
        if (!RAPIDAPI_KEY) {
            throw new Error('RapidAPI key is not configured. Please add RAPIDAPI_KEY to your .env file.');
        }

        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
        if (!YOUTUBE_API_KEY) {
            throw new Error('YouTube API key is not configured. Please add YOUTUBE_API_KEY to your .env file.');
        }

        let targetUrl = input.url;

        // If it's not a valid YouTube URL, perform a search
        if (!YouTube.isYouTube(targetUrl, { checkVideo: true, checkPlaylist: true })) {
            const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });
            const searchResponse = await youtube.search.list({
                part: ['id'],
                q: input.url,
                maxResults: 1,
                type: ['video'],
                videoCategoryId: '10' // Music Category
            });
            if (!searchResponse.data.items || searchResponse.data.items.length === 0 || !searchResponse.data.items[0].id?.videoId) {
                throw new Error(`No music video found for query: "${input.url}".`);
            }
            const videoId = searchResponse.data.items[0].id.videoId;
            targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }

        // Start the job and poll for results
        const jobId = await startDownloadJob(targetUrl);
        const result = await pollJobStatus(jobId);

        if (!result.videos || result.videos.length === 0) {
            throw new Error('The download job completed but returned no videos.');
        }

        // Map the results to our playlist item format
        const playlistItems: PlaylistItem[] = result.videos.map((video: any) => {
            const videoId = parseYouTubeVideoId(video.originalUrl) || video.id || jobId;
            return {
                id: videoId,
                title: video.title || 'Unknown Title',
                artist: video.channel || 'Unknown Artist',
                artId: selectArtId(videoId),
                url: video.url, // This is the direct download URL
                duration: video.duration || 0,
            };
        });

        return playlistItems;

    } catch (error) {
      console.error('An error occurred in the getYoutubeInfoFlow:', error);
      if (error instanceof Error) {
        throw error; // Re-throw the original error to be caught by the action
      }
      throw new Error('An unknown error occurred while fetching song info.');
    }
  }
);

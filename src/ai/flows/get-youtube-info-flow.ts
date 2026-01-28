'use server';
/**
 * @fileOverview A flow to fetch information about YouTube videos and playlists, download them, and return local paths.
 *
 * - getYoutubeInfo - A function that fetches data, downloads the audio, and returns local URLs.
 * - GetYoutubeInfoInput - The input type for the getYoutubeInfo function.
 * - GetYoutubeInfoOutput - The return type for the getYoutubeInfo function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { PlaylistItem } from '@/types/playlist';
import YoutubeMp3Downloader from 'youtube-mp3-downloader';
import path from 'path';
import fs from 'fs';

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

const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return hours * 3600 + minutes * 60 + seconds;
};

// --- Downloader and Genkit Flow ---

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
        throw new Error('YouTube API key is not configured. Please add YOUTUBE_API_KEY to your .env file.');
      }
      
      const outputPath = path.resolve(process.cwd(), 'public/audio');
      fs.mkdirSync(outputPath, { recursive: true });

      const YD = new YoutubeMp3Downloader({
        ffmpegPath: 'ffmpeg',
        outputPath: outputPath,
        youtubeVideoQuality: 'highestaudio',
      });

      const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });

      const playlistId = parseYouTubePlaylistId(input.url);
      const videoId = parseYouTubeVideoId(input.url);
      let videoIds: string[] = [];

      if (playlistId) {
        const playlistResponse = await youtube.playlistItems.list({ part: ['contentDetails'], playlistId: playlistId, maxResults: 50 });
        if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) throw new Error("Could not find that playlist or it's empty.");
        videoIds = playlistResponse.data.items.map(item => item.contentDetails?.videoId).filter((id): id is string => !!id);
      } else if (videoId) {
        videoIds.push(videoId);
      } else {
        const searchResponse = await youtube.search.list({ part: ['id'], q: input.url, maxResults: 1, type: ['video'], videoCategoryId: '10' });
        if (!searchResponse.data.items || searchResponse.data.items.length === 0 || !searchResponse.data.items[0].id?.videoId) {
          throw new Error(`No music video found for query: "${input.url}".`);
        }
        videoIds.push(searchResponse.data.items[0].id.videoId);
      }

      if (videoIds.length === 0) throw new Error('No videos found to process.');

      const videoDetailsResponse = await youtube.videos.list({ part: ['snippet', 'contentDetails'], id: videoIds });
      if (!videoDetailsResponse.data.items || videoDetailsResponse.data.items.length === 0) throw new Error('Could not fetch video details.');

      const downloadPromises = videoDetailsResponse.data.items.map(item => {
        return new Promise<PlaylistItem>((resolve, reject) => {
          if (!item.id) {
            return reject(new Error('Video item is missing an ID.'));
          }
          YD.download(item.id);
          YD.on('finished', (err, data) => {
            if (err) return reject(err);
            const webPath = '/' + path.relative(path.resolve(process.cwd(), 'public'), data.file).replace(/\\/g, '/');
            const playlistItem: PlaylistItem = {
              id: item.id!,
              title: item.snippet?.title || 'Unknown Title',
              artist: item.snippet?.channelTitle || 'Unknown Artist',
              artId: selectArtId(item.id!),
              url: webPath,
              duration: item.contentDetails?.duration ? parseDuration(item.contentDetails.duration) : 0,
            };
            resolve(playlistItem);
          });
          YD.on('error', (error) => {
            reject(error);
          });
        });
      });
      
      const results = await Promise.all(downloadPromises);
      return results;

    } catch (error) {
      console.error('An error occurred in the getYoutubeInfoFlow:', error);
      if (error instanceof Error) {
        if (error.message.includes('API key not valid')) throw new Error('The YouTube API key is invalid.');
        if ((error as any).response?.data?.error?.message) throw new Error(`YouTube API Error: ${(error as any).response.data.error.message}`);
        throw new Error(error.message || 'Failed to process song request.');
      }
      throw new Error('An unknown error occurred.');
    }
  }
);

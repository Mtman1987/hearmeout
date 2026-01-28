'use server';
/**
 * @fileOverview A flow to fetch information about YouTube videos and playlists,
 * download them as MP3s, and return their public URLs.
 *
 * - getYoutubeInfo - A function that fetches data for a given YouTube URL.
 * - GetYoutubeInfoInput - The input type for the getYoutubeInfo function.
 * - GetYoutubeInfoOutput - The return type for the getYoutubeInfo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import YoutubeMp3Downloader from 'youtube-mp3-downloader';
import path from 'path';
import fs from 'fs';
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


// --- Downloader Configuration ---

const audioOutputPath = path.join(process.cwd(), 'public', 'audio');
fs.mkdirSync(audioOutputPath, { recursive: true });

const YD = new YoutubeMp3Downloader({
    ffmpegPath: "ffmpeg", // Assumes FFmpeg is in PATH.
    outputPath: audioOutputPath,
    youtubeVideoQuality: "highestaudio",
    queueParallelism: 3, // Download 3 songs in parallel
    progressTimeout: 1000,
});


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


/**
 * Wraps the youtube-mp3-downloader in a Promise to be used with async/await.
 * This is necessary because the library uses event emitters (.on('finished', ...))
 * instead of returning a promise directly.
 * @param videoId The ID of the YouTube video to download.
 * @returns A Promise that resolves with the PlaylistItem data.
 */
function downloadVideoAsPromise(videoId: string, title: string, artist: string): Promise<PlaylistItem> {
    return new Promise((resolve, reject) => {
        // Start the download
        YD.download(videoId, `${videoId}.mp3`);

        const onFinished = (err: any, data: any) => {
            // The 'finished' event triggers for ANY completed download, so we must check the videoId.
            if (data && data.videoId === videoId) {
                // Cleanup listeners to prevent memory leaks
                YD.removeListener("finished", onFinished);
                YD.removeListener("error", onError);
                
                const publicUrl = `/audio/${path.basename(data.file)}`;
                resolve({
                    id: data.videoId,
                    title: data.videoTitle || title,
                    artist: data.artist || artist,
                    url: publicUrl,
                    artId: selectArtId(data.videoId),
                    duration: data.stats?.runtime || 0,
                });
            }
        };

        const onError = (error: any, data: any) => {
             // The 'error' event also triggers for any download, so check the videoId.
            if (data && data.videoId === videoId) {
                // Cleanup listeners to prevent memory leaks
                YD.removeListener("finished", onFinished);
                YD.removeListener("error", onError);
                
                console.error(`Download failed for ${videoId}:`, error);
                reject(new Error(`Failed to download audio for video ${videoId}. It may be region-locked or private.`));
            }
        };

        // Attach the listeners
        YD.on("finished", onFinished);
        YD.on("error", onError);
    });
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
        let videosToDownload: { id: string, title: string, artist: string }[] = [];
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

        if (playlistId) {
            const playlistResponse = await youtube.playlistItems.list({
                part: ['snippet'],
                playlistId: playlistId,
                maxResults: 50 // YouTube API max is 50 per page
            });

            const items = playlistResponse.data.items;
            if (!items || items.length === 0) {
                throw new Error("Could not find that playlist or it's empty.");
            }
            
            videosToDownload = items
                .filter(item => item.snippet?.resourceId?.videoId && item.snippet.title)
                .map(item => ({
                    id: item.snippet!.resourceId!.videoId!,
                    title: item.snippet!.title!,
                    artist: item.snippet!.videoOwnerChannelTitle || 'Unknown Artist'
                }));

        } else if (videoId) {
            const videoResponse = await youtube.videos.list({
                part: ['snippet'],
                id: [videoId]
            });
            const video = videoResponse.data.items?.[0];
            if (!video || !video.id || !video.snippet?.title) {
                throw new Error('Could not find video info for the given URL.');
            }
            videosToDownload.push({ 
                id: video.id, 
                title: video.snippet.title,
                artist: video.snippet.channelTitle || 'Unknown Artist'
            });

        } else {
            const searchResponse = await youtube.search.list({
                part: ['snippet'],
                q: input.url,
                maxResults: 1,
                type: ['video']
            });
            const searchResult = searchResponse.data.items?.[0];
            if (!searchResult || !searchResult.id?.videoId || !searchResult.snippet?.title) {
                throw new Error(`No video found for query: "${input.url}"`);
            }
            videosToDownload.push({ 
                id: searchResult.id.videoId, 
                title: searchResult.snippet.title,
                artist: searchResult.snippet.channelTitle || 'Unknown Artist'
            });
        }

        if (videosToDownload.length === 0) {
             throw new Error('No videos found to download.');
        }
        
        const downloadPromises = videosToDownload.map(video =>
            downloadVideoAsPromise(video.id, video.title, video.artist)
        );

        const settledResults = await Promise.allSettled(downloadPromises);
        
        const successfulDownloads: PlaylistItem[] = [];
        settledResults.forEach(result => {
            if (result.status === 'fulfilled') {
                successfulDownloads.push(result.value);
            } else {
                console.error("A song failed to download:", result.reason);
            }
        });

        if (successfulDownloads.length === 0) {
            throw new Error('Failed to download any songs from the request. They may be private, region-locked, or too long.');
        }

        return successfulDownloads;

    } catch (error) {
        console.error('An error occurred in the getYoutubeInfoFlow:', error);
        if (error instanceof Error) {
            // Check for API-specific error messages
            if (error.message.includes('API key not valid')) {
                throw new Error('The YouTube API key is invalid. Please check the server configuration.');
            }
            throw new Error(error.message || 'Failed to process song request.');
        }
        throw new Error('An unknown error occurred while processing the song request.');
    }
  }
);

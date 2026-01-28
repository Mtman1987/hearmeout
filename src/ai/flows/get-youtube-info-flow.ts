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
import {YouTube} from 'youtube-sr';
import YoutubeMp3Downloader from 'youtube-mp3-downloader';
import path from 'path';
import fs from 'fs';
import { PlaylistItem } from '@/types/playlist';

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

/**
 * Wraps the youtube-mp3-downloader in a Promise to be used with async/await.
 * This is necessary because the library uses event emitters (.on('finished', ...))
 * instead of returning a promise directly.
 * @param videoId The ID of the YouTube video to download.
 * @returns A Promise that resolves with the PlaylistItem data.
 */
function downloadVideoAsPromise(videoId: string, title: string): Promise<PlaylistItem> {
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
                    artist: data.artist || 'Unknown Artist',
                    url: publicUrl,
                    artId: selectArtId(data.videoId),
                    // duration is not provided by this library, default to 0
                    duration: data.stats.runtime || 0,
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
        let videosToDownload: { id: string, title: string }[] = [];

        // 1. Determine if input is a URL or a search query
        if (YouTube.isPlaylist(input.url)) {
            const playlist = await YouTube.getPlaylist(input.url, { fetchAll: true });
            if (!playlist || playlist.videos.length === 0) {
                 return [];
            }
            videosToDownload = playlist.videos
                .filter(v => v.id && v.title)
                .map(v => ({ id: v.id!, title: v.title! }));

        } else if (YouTube.isYouTube(input.url, { checkVideo: true })) {
             const video = await YouTube.getVideo(input.url);
             if (!video || !video.id || !video.title) throw new Error('Could not find video info.');
             videosToDownload.push({ id: video.id, title: video.title });

        } else {
            const searchResults = await YouTube.search(input.url, { limit: 1, type: 'video' });
            if (!searchResults[0] || !searchResults[0].id || !searchResults[0].title) {
                throw new Error(`No video found for query: "${input.url}"`);
            }
            const video = searchResults[0];
            videosToDownload.push({ id: video.id, title: video.title });
        }

        if (videosToDownload.length === 0) {
             throw new Error('No videos found to download.');
        }
        
        // 2. Create a download promise for each video
        // We use Promise.allSettled to ensure that even if one download fails, the others can continue.
        const downloadPromises = videosToDownload.map(video =>
            downloadVideoAsPromise(video.id, video.title)
        );

        // 3. Wait for all downloads to settle
        const settledResults = await Promise.allSettled(downloadPromises);
        
        const successfulDownloads: PlaylistItem[] = [];
        settledResults.forEach(result => {
            if (result.status === 'fulfilled') {
                successfulDownloads.push(result.value);
            } else {
                // Log the error for debugging but don't crash the whole flow
                console.error("A song failed to download:", result.reason);
            }
        });

        // 4. Return only the successfully downloaded songs
        if (successfulDownloads.length === 0) {
            // This will be caught by the client and shown as a toast.
            throw new Error('Failed to download any songs from the request. They may be private or region-locked.');
        }

        return successfulDownloads;

    } catch (error) {
        console.error('An error occurred in the getYoutubeInfoFlow:', error);
        // Throwing the error will propagate it to the client-side caller.
        // Re-throw a more user-friendly message.
        if (error instanceof Error) {
            throw new Error(error.message || 'Failed to process song request.');
        }
        throw new Error('An unknown error occurred while processing the song request.');
    }
  }
);

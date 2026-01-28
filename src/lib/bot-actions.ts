'use server';

import { db } from '@/firebase/admin';
import { YouTube } from 'youtube-sr';
import { PlaylistItem } from "@/app/rooms/[roomId]/_components/Playlist";

// A simple deterministic hash function to select album art from the existing set
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
    if (!videoId) return artIds[0];
    const hash = simpleHash(videoId);
    return artIds[hash % artIds.length];
}

/**
 * Searches for a song/playlist on YouTube and adds it to the specified room's playlist in Firestore.
 * @param songQuery The search term or YouTube URL.
 * @param roomId The ID of the room to add the song to.
 * @param requester The name of the user who requested the song.
 * @returns A promise that resolves to an object with a success flag and a message.
 */
export async function addSongToPlaylist(songQuery: string, roomId: string, requester: string): Promise<{success: boolean, message: string}> {
  if (!roomId) {
    return { success: false, message: 'No room ID provided.' };
  }
  
  const roomRef = db.collection('rooms').doc(roomId);

  try {
    const isUrl = YouTube.isYouTube(songQuery, { checkVideo: true, checkPlaylist: true });
    let videosToAdd: PlaylistItem[] = [];

    if (isUrl) {
        if(YouTube.isPlaylist(songQuery)) {
            const playlist = await YouTube.getPlaylist(songQuery);
            if (!playlist || playlist.videos.length === 0) {
                 return { success: false, message: `I couldn't find that playlist or it's empty.` };
            }
            videosToAdd = playlist.videos.map(video => ({
                id: video.id!,
                title: video.title || 'Untitled',
                artist: video.channel?.name || 'Unknown Artist',
                url: video.url,
                artId: selectArtId(video.id!),
            }));

        } else {
            const video = await YouTube.getVideo(songQuery);
             if (!video || !video.id) {
                return { success: false, message: `I couldn't find a video at that URL.` };
            }
            videosToAdd.push({
                id: video.id,
                title: video.title || 'Untitled',
                artist: video.channel?.name || 'Unknown Artist',
                url: video.url,
                artId: selectArtId(video.id),
            });
        }
    } else {
        const searchResults = await YouTube.search(songQuery, { limit: 1, type: 'video' });
        if (!searchResults || searchResults.length === 0 || !searchResults[0].id) {
            return { success: false, message: `I couldn't find a song matching "${songQuery}".` };
        }
        const video = searchResults[0];
        videosToAdd.push({
            id: video.id!,
            title: video.title || 'Untitled',
            artist: video.channel?.name || 'Unknown Artist',
            url: video.url,
            artId: selectArtId(video.id!),
        });
    }
    
    if (videosToAdd.length === 0) {
        return { success: false, message: `I couldn't find any songs for "${songQuery}".` };
    }

    const firstSongAdded = videosToAdd[0];

    await db.runTransaction(async (transaction) => {
      const roomDoc = await transaction.get(roomRef);
      if (!roomDoc.exists) {
        throw new Error(`Room with ID ${roomId} does not exist.`);
      }
      const roomData = roomDoc.data();
      const currentPlaylist = roomData?.playlist || [];
      const newPlaylist = [...currentPlaylist, ...videosToAdd];
      
      const updates: { playlist: PlaylistItem[], isPlaying?: boolean, currentTrackId?: string } = {
          playlist: newPlaylist
      };

      // If nothing is playing and there was no playlist before, start playing the new song.
      if (!roomData?.isPlaying && currentPlaylist.length === 0) {
          updates.isPlaying = true;
          updates.currentTrackId = firstSongAdded.id;
      }
      
      transaction.update(roomRef, updates);
    });

    const message = videosToAdd.length > 1
        ? `Queued up ${videosToAdd.length} songs from the playlist.`
        : `Queued up: "${firstSongAdded.title}"`;

    return { success: true, message };

  } catch (error: any) {
    console.error(`Error processing song request for room ${roomId}:`, error);
    return { success: false, message: 'An internal error occurred while processing your request.' };
  }
}

import 'dotenv/config';
import tmi from 'tmi.js';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { YouTube } from 'youtube-sr';

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
    if (!videoId) {
        return artIds[0];
    }
    const hash = simpleHash(videoId);
    return artIds[hash % artIds.length];
}

// --- Firebase Admin SDK Initialization ---
// The SDK will automatically use the credentials from the GOOGLE_APPLICATION_CREDENTIALS env var.
try {
    admin.initializeApp();
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error: any) {
    if (error.code === 'app/duplicate-app') {
        console.log("Firebase Admin SDK already initialized.");
    } else {
        console.error("Firebase Admin SDK initialization error:", error);
        console.log("Please ensure you have set up your GOOGLE_APPLICATION_CREDENTIALS environment variable correctly. See BOT_SETUP.md for details.");
        process.exit(1);
    }
}
const db = getFirestore();

// --- Twitch Bot Configuration ---
const twitchBotUsername = process.env.TWITCH_BOT_USERNAME;
const twitchBotOauthToken = process.env.TWITCH_BOT_OAUTH_TOKEN;
const twitchChannelName = process.env.TWITCH_CHANNEL_NAME;
const targetRoomId = process.env.TARGET_ROOM_ID;

if (!twitchBotUsername || !twitchBotOauthToken || !twitchChannelName || !targetRoomId) {
    console.error("Missing required environment variables for Twitch bot. Please check your .env file and BOT_SETUP.md.");
    process.exit(1);
}

const opts = {
  identity: {
    username: twitchBotUsername,
    password: twitchBotOauthToken,
  },
  channels: [twitchChannelName],
};

// --- Bot Main Logic ---
const client = new tmi.client(opts);

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect().catch((err) => {
    console.error("Failed to connect to Twitch:", err);
});

function onConnectedHandler(addr: any, port: any) {
  console.log(`* Connected to ${addr}:${port}`);
  console.log(`* Listening for !sr commands in #${twitchChannelName}`);
  console.log(`* Adding songs to room: ${targetRoomId}`);
}

async function onMessageHandler(target: any, context: any, msg: any, self: any) {
  if (self) { return; } // Ignore messages from the bot itself

  const commandName = msg.trim();
  if (!commandName.startsWith('!sr ')) {
    return;
  }

  const songQuery = commandName.substring(4).trim();
  if (!songQuery) {
    return;
  }
  
  console.log(`* Received !sr command from ${context.username}: ${songQuery}`);

  try {
    const searchResults = await YouTube.search(songQuery, { limit: 1, type: 'video' });
    if (!searchResults || searchResults.length === 0 || !searchResults[0].id) {
      client.say(target, `Could not find a song for "${songQuery}" on YouTube.`);
      return;
    }
    const video = searchResults[0];

    const newPlaylistItem = {
      id: video.id!,
      title: video.title || 'Untitled',
      artist: video.channel?.name || 'Unknown Artist',
      url: video.url,
      artId: selectArtId(video.id!),
    };

    const roomRef = db.collection('rooms').doc(targetRoomId);
    
    // Use a transaction to safely add to the playlist array
    await db.runTransaction(async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists) {
            console.error(`Room with ID ${targetRoomId} does not exist.`);
            // Optionally, send a message back to chat if the room is wrong.
            // client.say(target, `Error: The target room ID is invalid.`);
            return;
        }
        const roomData = roomDoc.data();
        const currentPlaylist = roomData?.playlist || [];
        const newPlaylist = [...currentPlaylist, newPlaylistItem];
        transaction.update(roomRef, { playlist: newPlaylist });
    });
    
    client.say(target, `Added "${video.title}" to the queue!`);
    console.log(`* Added song to playlist: ${video.title}`);

  } catch (error) {
    console.error("Error processing !sr command:", error);
    client.say(target, `Sorry, something went wrong while adding the song.`);
  }
}

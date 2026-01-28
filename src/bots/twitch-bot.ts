import 'dotenv/config';
import tmi from 'tmi.js';
import { addSongToPlaylist } from '@/lib/bot-actions';

// --- Twitch Bot Configuration ---
// Ensure all necessary environment variables are present.
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
    process.exit(1); // Exit if we can't connect.
});

function onConnectedHandler(addr: any, port: any) {
  console.log(`* Connected to ${addr}:${port}`);
  console.log(`* Listening for !sr commands in #${twitchChannelName}`);
  console.log(`* Adding songs to room: ${targetRoomId}`);
}

async function onMessageHandler(target: string, context: tmi.ChatUserstate, msg: string, self: boolean) {
  if (self) { return; } // Ignore messages from the bot itself

  const message = msg.trim();
  if (!message.toLowerCase().startsWith('!sr ')) {
    return;
  }

  const songQuery = message.substring(4).trim();
  const requester = context['display-name'] || 'Someone from Twitch';
  
  if (!songQuery) {
    return; // Don't do anything if the query is empty
  }
  
  console.log(`* Received !sr command from ${requester}: ${songQuery}`);

  try {
    const result = await addSongToPlaylist(songQuery, targetRoomId!, requester);
    
    if (result.success) {
      client.say(target, `@${requester}, ${result.message}`);
      console.log(`* Success: ${result.message}`);
    } else {
      client.say(target, `@${requester}, sorry, an error occurred: ${result.message}`);
      console.error(`* Failed to add song: ${result.message}`);
    }
  } catch (error) {
    console.error("Error processing !sr command:", error);
    client.say(target, `@${requester}, sorry, a critical error occurred while adding the song.`);
  }
}

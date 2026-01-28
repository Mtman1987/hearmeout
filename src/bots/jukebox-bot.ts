
import 'dotenv/config';
import { Room, AccessToken } from 'livekit-server-sdk';

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
const livekitApiKey = process.env.LIVEKIT_API_KEY;
const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
const targetRoomId = process.env.TARGET_ROOM_ID;

// A clearer startup check
if (!livekitUrl || !livekitApiKey || !livekitApiSecret || !targetRoomId || livekitUrl.includes("REPLACE_ME") || livekitApiKey.includes("REPLACE_ME") || livekitApiSecret.includes("REPLACE_ME") || targetRoomId.includes("REPLACE_ME")) {
    console.error("🔴 Jukebox Bot is not configured. Please fill in the LiveKit details in your .env file.");
    console.error("   - NEXT_PUBLIC_LIVEKIT_URL");
    console.error("   - LIVEKIT_API_KEY");
    console.error("   - LIVEKIT_API_SECRET");
    console.error("   - TARGET_ROOM_ID");
    process.exit(1);
}


async function connectBot() {
    try {
        const room = new Room();

        room.on('connected', () => {
            console.log(`✅ Jukebox bot connected silently to room: ${targetRoomId}`);
            console.log(`   Bot Participant ID: ${room.localParticipant.identity}`);
            console.log("   The bot is now waiting silently as a connected user.");
        });
        
        room.on('disconnected', () => {
            console.log('Jukebox bot disconnected. Reconnecting in 5 seconds...');
            setTimeout(connectBot, 5000);
        });

        const token = new AccessToken(livekitApiKey, livekitApiSecret, {
            identity: 'jukebox',
            name: 'Jukebox',
        });
        token.addGrant({ room: targetRoomId, roomJoin: true, canPublish: false, canSubscribe: false });
        
        console.log(`Attempting to connect Jukebox bot to LiveKit room: ${targetRoomId}`);
        await room.connect(livekitUrl, token.toJwt());

    } catch (error) {
        console.error("🔴 Failed to connect Jukebox bot:", error);
        console.log("   Please check your LiveKit credentials in the .env file.");
        setTimeout(connectBot, 5000);
    }
}

connectBot();

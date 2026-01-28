
import 'dotenv/config';
import { Room, RoomServiceClient, AccessToken } from 'livekit-server-sdk';

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
const livekitApiKey = process.env.LIVEKIT_API_KEY;
const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
const targetRoomId = process.env.TARGET_ROOM_ID;

if (!livekitUrl || !livekitApiKey || !livekitApiSecret || !targetRoomId) {
    console.error("Missing required LiveKit or Room environment variables. Please check your .env file and BOT_SETUP.md.");
    process.exit(1);
}

const roomService = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);
let room: Room;

async function connectBot() {
    try {
        room = new Room();

        // On successful connection, log it. The bot will then just idle.
        room.on('connected', () => {
            console.log(`Jukebox bot successfully connected to room: ${room.name}`);
            console.log(`Bot identity: ${room.localParticipant.identity}`);
            console.log("The bot is now idling and producing SILENCE as requested.");
            console.log("It will not play any music until it is programmed to do so in the next step.");
        });
        
        room.on('disconnected', () => {
            console.log('Jukebox bot disconnected from the room. It will try to reconnect.');
            // Basic reconnection logic
            setTimeout(connectBot, 5000);
        });

        // Create a token for the bot with the identity 'jukebox'
        const token = new AccessToken(livekitApiKey, livekitApiSecret, {
            identity: 'jukebox',
            name: 'Jukebox',
        });
        token.addGrant({ room: targetRoomId, roomJoin: true, canPublish: false, canSubscribe: false });
        
        console.log(`Attempting to connect Jukebox bot to LiveKit room: ${targetRoomId}`);
        await room.connect(livekitUrl, token.toJwt());

    } catch (error) {
        console.error("Failed to connect Jukebox bot to LiveKit room:", error);
        // Retry connection after a delay
        setTimeout(connectBot, 5000);
    }
}

async function main() {
    console.log(`Initializing silent Jukebox bot for room: ${targetRoomId}`);
    await connectBot();
}

main();

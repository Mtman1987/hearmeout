// This file does not use 'dotenv/config' because it's intended to be used
// in a Next.js server environment where process.env is already populated.

/**
 * Sends a pre-defined control embed to a specified Discord channel.
 * This embed includes a "Request a Song" button.
 *
 * @param channelId The ID of the Discord channel to send the message to.
 */
export async function sendControlEmbed(channelId: string) {
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

    if (!DISCORD_BOT_TOKEN) {
        console.error("DISCORD_BOT_TOKEN is not set in environment variables.");
        throw new Error("Discord bot is not configured on the server.");
    }
    
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

    const body = {
        // You can add a text message here if you want
        // content: "New controls have been posted!",
        embeds: [
            {
                title: "🎵 HearMeOut Player",
                description: "Click the button below to request a song to be added to the queue.",
                color: 5814783, // A nice blue color (#58b9ff)
            }
        ],
        components: [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 1, // Primary (blue)
                        label: "Request a Song",
                        // This custom_id is crucial. We will build an endpoint
                        // to listen for interactions with this ID.
                        custom_id: "request_song_modal_trigger", 
                    }
                ]
            }
        ]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to send Discord message:", errorData);
        throw new Error(`Failed to send message to Discord. Status: ${response.status}`);
    }

    return response.json();
}

import { NextRequest, NextResponse } from 'next/server';
import { addSongToPlaylist } from '@/lib/bot-actions';

// Discord Interaction Types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
};

// Discord Interaction Response Types
const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
};

// This is where you'd verify the request signature, but we'll skip it for now.
// For a production app, you must verify the signature.
// See: https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { type, data, member, token } = body;

  // Handle Discord's mandatory PING command
  if (type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // Handle a button click from the control embed
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const { custom_id } = data;

    if (custom_id === 'request_song_modal_trigger') {
      // Respond with a modal (pop-up form)
      return NextResponse.json({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: 'request_song_modal_submit',
          title: 'Request a Song',
          components: [
            {
              type: 1, // Action Row
              components: [
                {
                  type: 4, // Text Input
                  custom_id: 'song_request_input',
                  label: 'Song Name or YouTube URL',
                  style: 1, // Short text
                  required: true,
                  placeholder: 'e.g., Lofi Hip Hop Radio or a specific YouTube link',
                },
              ],
            },
          ],
        },
      });
    }
  }

  // Handle the modal submission from the user
  if (type === InteractionType.MODAL_SUBMIT) {
    const { custom_id } = data;

    if (custom_id === 'request_song_modal_submit') {
      const songQuery = data.components[0].components[0].value;
      const requester = member?.user?.global_name || member?.user?.username || 'Someone from Discord';
      
      const targetRoomId = process.env.TARGET_ROOM_ID;
      if (!targetRoomId) {
          console.error("TARGET_ROOM_ID is not set in .env for the Discord interaction.");
          return NextResponse.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: '❌ Sorry, the bot is not configured correctly on the server (missing Room ID).',
                    flags: 64 // Ephemeral (only visible to the user)
                }
          });
      }

      // We must acknowledge the interaction quickly, so we process the request
      // asynchronously and use a deferred response.
      const processingPromise = addSongToPlaylist(songQuery, targetRoomId, requester);

      processingPromise.then(result => {
        const clientId = process.env.DISCORD_CLIENT_ID;
        if (!clientId) {
            console.error("DISCORD_CLIENT_ID is not set in .env for the Discord interaction.");
            return;
        }
        // This URL is used to edit the original deferred response
        const followupUrl = `https://discord.com/api/v10/webhooks/${clientId}/${token}/messages/@original`;
        
        fetch(followupUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: result.success ? `✅ ${result.message}` : `❌ Sorry, an error occurred: ${result.message}`,
          }),
        }).catch(err => console.error("Discord followup message failed:", err));

      }).catch(err => {
        console.error("Error in addSongToPlaylist from Discord interaction:", err);
      });

      // Immediately respond to Discord to let them know we're working on it.
      // This prevents the "This interaction failed" message on the user's end.
      return NextResponse.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            flags: 64 // Make the response ephemeral (only visible to the user who clicked)
        }
      });
    }
  }

  // Fallback response for unhandled interactions
  console.warn("Unhandled Discord interaction type:", type);
  return NextResponse.json({ error: 'Unhandled interaction type' }, { status: 400 });
}

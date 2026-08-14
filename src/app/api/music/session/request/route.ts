import { NextRequest, NextResponse } from 'next/server';
import { addSongToPlaylist } from '@/lib/bot-actions';
import { requireSpmtBridgeUser } from '@/lib/spmt-server-auth';
import { ensureSpmtMusicRoom, publicRoomState } from '@/lib/spmt-music-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireSpmtBridgeUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const query = String(body?.query || body?.song || body?.message || '').trim().slice(0, 500);
  if (!query) return NextResponse.json({ error: 'Song query is required.' }, { status: 400 });

  try {
    const { roomId, roomRef } = await ensureSpmtMusicRoom(auth.user);
    const requester = String(body?.username || auth.user.displayName || auth.user.username || 'SPMT').trim().slice(0, 80);
    const result = await addSongToPlaylist(query, roomId, requester);
    if (!result.success) return NextResponse.json({ error: result.message }, { status: 422 });

    const snapshot = await roomRef.get();
    const state = publicRoomState(roomId, snapshot.data() || {});
    const queuedTrack = state.queue.length ? state.queue[state.queue.length - 1] : null;
    return NextResponse.json({
      ok: true,
      message: result.message,
      query,
      queuedTrack,
      ...state,
      playbackStarted: Boolean(state.isPlaying && state.currentTrackId),
      note: state.djConnected
        ? 'The room is playing through its active DJ client.'
        : 'The room state is playing. Open the returned room on a HearMeOut client to provide the room audio/DJ connection.',
    });
  } catch (error) {
    console.error('[SPMT HearMeOut request] Error:', error);
    return NextResponse.json({ error: 'Unable to create the HearMeOut room or queue that request.' }, { status: 500 });
  }
}

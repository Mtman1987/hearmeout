import { NextRequest, NextResponse } from 'next/server';
import { requireSpmtBridgeUser } from '@/lib/spmt-server-auth';
import { ensureSpmtMusicRoom, publicRoomState } from '@/lib/spmt-music-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireSpmtBridgeUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').trim().toLowerCase();
  if (!action) return NextResponse.json({ error: 'Playback action is required.' }, { status: 400 });

  try {
    const { roomId, roomRef } = await ensureSpmtMusicRoom(auth.user);
    await roomRef.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data() || {};
      const playlist = Array.isArray(data.playlist) ? data.playlist : [];
      const currentId = String(data.currentTrackId || '');
      const currentIndex = playlist.findIndex((track: any) => String(track?.id || '') === currentId);

      if (action === 'play' || action === 'resume' || action === 'start') {
        transaction.update(roomRef, {
          isPlaying: playlist.length > 0,
          currentTrackId: currentId || String(playlist[0]?.id || '') || null,
        });
        return;
      }
      if (action === 'pause') {
        transaction.update(roomRef, { isPlaying: false });
        return;
      }
      if (action === 'stop') {
        transaction.update(roomRef, { isPlaying: false });
        return;
      }
      if (action === 'skip' || action === 'next') {
        const next = currentIndex >= 0 ? playlist[currentIndex + 1] : playlist[0];
        transaction.update(roomRef, {
          currentTrackId: next?.id || null,
          isPlaying: Boolean(next),
        });
        return;
      }
      if (action === 'previous' || action === 'back') {
        const previous = currentIndex > 0 ? playlist[currentIndex - 1] : playlist[0];
        transaction.update(roomRef, {
          currentTrackId: previous?.id || null,
          isPlaying: Boolean(previous),
        });
        return;
      }
      throw new Error(`Unsupported playback action: ${action}`);
    });

    const snapshot = await roomRef.get();
    return NextResponse.json({ ok: true, action, ...publicRoomState(roomId, snapshot.data() || {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to control the HearMeOut room.';
    const status = message.startsWith('Unsupported playback action:') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

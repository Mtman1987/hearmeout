import { NextRequest, NextResponse } from 'next/server';
import { requireSpmtBridgeUser } from '@/lib/spmt-server-auth';
import { ensureSpmtMusicRoom, publicRoomState } from '@/lib/spmt-music-session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireSpmtBridgeUser(request);
  if (!auth.ok) return auth.response;
  try {
    const { roomId, roomRef } = await ensureSpmtMusicRoom(auth.user);
    const snapshot = await roomRef.get();
    return NextResponse.json({ ok: true, ...publicRoomState(roomId, snapshot.data() || {}) });
  } catch (error) {
    console.error('[SPMT HearMeOut state] Error:', error);
    return NextResponse.json({ error: 'Unable to read the HearMeOut room.' }, { status: 500 });
  }
}

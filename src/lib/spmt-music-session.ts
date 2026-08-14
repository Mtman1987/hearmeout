import { db } from '@/firebase/admin';
import type { SpmtBridgeUser } from '@/lib/spmt-server-auth';

export function spmtRoomId(userId: string) {
  const safe = String(userId || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72);
  return `spmt-${safe || 'user'}`;
}

export async function ensureSpmtMusicRoom(user: SpmtBridgeUser) {
  const roomId = spmtRoomId(user.id);
  const roomRef = db.collection('rooms').doc(roomId);
  const snapshot = await roomRef.get();
  if (!snapshot.exists) {
    await roomRef.set({
      name: `${user.displayName || user.username || 'SPMT'}'s HearMeOut Room`,
      description: 'Personal HearMeOut room created from SpaceMountain voice control.',
      ownerId: `spmt:${user.id}`,
      spmtUserId: user.id,
      isPrivate: true,
      playlist: [],
      isPlaying: false,
      currentTrackId: null,
      createdAt: new Date().toISOString(),
      source: 'spmt-voice',
    });
  } else if (String(snapshot.data()?.spmtUserId || '') !== String(user.id)) {
    throw new Error('HearMeOut room ownership mismatch.');
  }
  return { roomId, roomRef };
}

export function publicRoomState(roomId: string, data: Record<string, any>) {
  const playlist = Array.isArray(data.playlist) ? data.playlist : [];
  const currentTrackId = String(data.currentTrackId || '');
  const currentTrack = playlist.find((track: any) => String(track?.id || '') === currentTrackId) || null;
  return {
    roomId,
    roomUrl: `https://hearmeout-main.fly.dev/rooms/${encodeURIComponent(roomId)}`,
    launchUrl: `https://hearmeout-main.fly.dev/rooms/${encodeURIComponent(roomId)}`,
    isPlaying: Boolean(data.isPlaying),
    currentTrackId: currentTrackId || null,
    currentTrack,
    queue: playlist,
    queueLength: playlist.length,
    djConnected: Boolean(data.djId),
  };
}

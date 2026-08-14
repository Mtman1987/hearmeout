import { NextRequest, NextResponse } from 'next/server';

export type SpmtBridgeUser = {
  id: string;
  username?: string;
  displayName?: string;
  email?: string;
};

export async function requireSpmtBridgeUser(request: NextRequest): Promise<
  { ok: true; token: string; user: SpmtBridgeUser }
  | { ok: false; response: NextResponse }
> {
  const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'SPMT authentication required.' }, { status: 401 }) };
  }

  try {
    const response = await fetch('https://spmt.live/api/me', {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null);
    const user = payload?.user;
    if (!response.ok || !user?.id) {
      return { ok: false, response: NextResponse.json({ error: 'Invalid or expired SPMT session.' }, { status: 401 }) };
    }
    return {
      ok: true,
      token,
      user: {
        id: String(user.id),
        username: String(user.username || ''),
        displayName: String(user.displayName || user.display_name || ''),
        email: String(user.email || ''),
      },
    };
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'SPMT authentication is temporarily unavailable.' }, { status: 502 }) };
  }
}

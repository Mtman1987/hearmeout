import { NextRequest, NextResponse } from 'next/server';

const PIPED_INSTANCES = [
  "https://piped.video",
  "https://pipedapi.kavin.rocks",
  "https://piped.mha.fi",
  "https://piped.privacydev.net"
];

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
  } catch {
    return null;
  }
  return null;
}

async function getYoutubeAudioUrl(youtubeUrl: string) {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error("Invalid YouTube URL");

  let lastError: Error | null = null;

  for (const instance of PIPED_INSTANCES) {
    try {
      const apiUrl = `${instance}/streams/${videoId}`;
      // Use global fetch available in Next.js
      const res = await fetch(apiUrl, { next: { revalidate: 3600 } }); // Cache for 1 hour
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${instance}`);

      const data = await res.json();
      if (!data.audioStreams?.length) throw new Error("No audio streams found");

      const best = data.audioStreams.sort((a: any, b: any) => b.bitrate - a.bitrate)[0];

      return {
        url: best.url,
        bitrate: best.bitrate,
        codec: best.codec,
        source: instance
      };
    } catch (err: any) {
      console.warn(`Piped instance ${instance} failed:`, err.message);
      lastError = err;
      continue;
    }
  }

  console.error("All Piped instances failed. Last error:", lastError);
  throw new Error("All Piped instances failed: " + lastError?.message);
}


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: "Missing url query parameter" }, { status: 400 });
  }

  try {
    const result = await getYoutubeAudioUrl(url as string);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

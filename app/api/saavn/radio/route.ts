import { RADIO_SONG_IDS } from "@/app/data";
import { getSongs } from "@/lib/jiosaavn";

const ONE_DAY = 60 * 60 * 24;
const ATTEMPTS = 3;

// Hands back one random track from the hidden radio pool. The pool itself never leaves the
// server — idle playback pulls a single resolved song at a time instead of shipping ~150
// entries to every visitor. `exclude` keeps a track from immediately following itself.
export async function GET(request: Request) {
  const exclude = new URL(request.url).searchParams.get("exclude");
  const pool = RADIO_SONG_IDS.filter((id) => id !== exclude);
  if (pool.length === 0) return Response.json({ error: "The radio pool is empty." }, { status: 404 });

  try {
    // A dead id shouldn't leave an unattended radio stuck in silence, so try a few.
    const tried = new Set<string>();
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      if (tried.has(id)) continue;
      tried.add(id);

      const [song] = await getSongs([id], ONE_DAY);
      if (song?.mediaUrl) return Response.json({ song });
    }
    return Response.json({ error: "No playable track came back." }, { status: 404 });
  } catch {
    return Response.json({ error: "JioSaavn is unavailable right now." }, { status: 502 });
  }
}

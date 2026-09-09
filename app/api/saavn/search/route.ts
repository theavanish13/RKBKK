import { searchSongs } from "@/lib/jiosaavn";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return Response.json({ error: "A search query is required." }, { status: 400 });

  try {
    return Response.json({ results: await searchSongs(query) });
  } catch {
    return Response.json({ error: "JioSaavn search is unavailable right now." }, { status: 502 });
  }
}

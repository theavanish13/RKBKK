import { getSong } from "@/lib/jiosaavn";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const id = searchParams.get("id")?.trim();
  if (!id) return Response.json({ error: "A song id is required." }, { status: 400 });

  try {
    const song = await getSong(id, searchParams.get("lyrics") === "true");
    if (!song) return Response.json({ error: "That song could not be found." }, { status: 404 });
    return Response.json({ song });
  } catch {
    return Response.json({ error: "JioSaavn is unavailable right now." }, { status: 502 });
  }
}

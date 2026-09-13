import { getSuggestions } from "@/lib/jiosaavn";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return Response.json({ suggestions: [] });

  try {
    return Response.json({ suggestions: await getSuggestions(query) });
  } catch {
    // Suggestions are a non-critical enhancement — fail quiet rather than surface an error.
    return Response.json({ suggestions: [] });
  }
}

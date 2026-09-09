// TypeScript port of cyberboysumanjay/JioSaavnAPI (https://github.com/cyberboysumanjay/JioSaavnAPI),
// which wraps JioSaavn's internal api.php endpoints and decrypts their media URLs.
import { Buffer } from "node:buffer";
import crypto from "node:crypto";

const API_BASE = "https://www.jiosaavn.com/api.php";
const MEDIA_URL_KEY = "38346591";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type SearchResult = {
  id: string;
  title: string;
  album: string;
  artists: string;
  image: string;
  url: string;
};

export type Song = {
  id: string;
  title: string;
  album: string;
  albumId: string;
  artists: string;
  singers: string;
  image: string;
  year: string;
  language: string;
  label: string;
  copyright: string;
  duration: number;
  hasLyrics: boolean;
  permaUrl: string;
  mediaUrl: string;
  previewUrl: string;
  lyrics?: string | null;
};

type RawSearchSong = {
  id: string;
  song: string;
  album: string;
  image: string;
  perma_url: string;
  primary_artists?: string;
  singers?: string;
};

type RawSong = {
  id: string;
  song: string;
  album: string;
  albumid: string;
  primary_artists: string;
  singers: string;
  image: string;
  year: string;
  language: string;
  label: string;
  copyright_text?: string;
  duration: string;
  has_lyrics: string;
  perma_url: string;
  "320kbps": string;
  encrypted_media_url?: string;
  media_preview_url?: string;
};

async function callApi<T>(params: Record<string, string>, revalidate?: number): Promise<T> {
  const url = new URL(API_BASE);
  url.search = new URLSearchParams({ _format: "json", _marker: "0", cc: "in", ...params }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    ...(revalidate === undefined ? { cache: "no-store" as const } : { next: { revalidate } }),
  });
  if (!response.ok) throw new Error(`JioSaavn responded with ${response.status}`);
  return JSON.parse(await response.text()) as T;
}

// JioSaavn escapes a handful of entities inside otherwise plain text fields.
function decodeText(value: string | undefined) {
  return (value ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&copy;/g, "©");
}

function upscaleImage(image: string | undefined) {
  return (image ?? "").replace("50x50", "500x500").replace("150x150", "500x500");
}

// The upstream project uses single DES in ECB mode with PKCS5 padding. OpenSSL 3 dropped plain
// `des-ecb` from its default provider, but triple DES with all three subkeys equal is identical to it.
export function decryptMediaUrl(encryptedUrl: string) {
  const key = Buffer.from(MEDIA_URL_KEY.repeat(3), "utf8");
  const decipher = crypto.createDecipheriv("des-ede3", key, null);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedUrl.trim(), "base64")),
    decipher.final(),
  ]).toString("utf8");
  return decrypted.replace("_96.mp4", "_320.mp4");
}

function resolveMediaUrls(song: RawSong) {
  const isHighBitrate = song["320kbps"] === "true";
  let mediaUrl: string;

  if (song.encrypted_media_url) {
    mediaUrl = decryptMediaUrl(song.encrypted_media_url);
    if (!isHighBitrate) mediaUrl = mediaUrl.replace("_320.mp4", "_160.mp4");
  } else {
    // Fall back to rebuilding the stream URL from the 96kbps preview, as the upstream project does.
    mediaUrl = (song.media_preview_url ?? "")
      .replace("preview", "aac")
      .replace("_96_p.mp4", isHighBitrate ? "_320.mp4" : "_160.mp4");
  }

  const previewUrl = mediaUrl.replace("_320.mp4", "_96_p.mp4").replace("_160.mp4", "_96_p.mp4").replace("//aac.", "//preview.");
  return { mediaUrl, previewUrl };
}

function formatSong(song: RawSong, lyrics?: string | null): Song {
  const { mediaUrl, previewUrl } = resolveMediaUrls(song);
  return {
    id: song.id,
    title: decodeText(song.song),
    album: decodeText(song.album),
    albumId: song.albumid,
    artists: decodeText(song.primary_artists),
    singers: decodeText(song.singers),
    image: upscaleImage(song.image),
    year: song.year,
    language: song.language,
    label: decodeText(song.label),
    copyright: decodeText(song.copyright_text),
    duration: Number(song.duration) || 0,
    hasLyrics: song.has_lyrics === "true",
    permaUrl: song.perma_url,
    mediaUrl,
    previewUrl,
    ...(lyrics === undefined ? {} : { lyrics }),
  };
}

// search.getResults is JioSaavn's real search endpoint; unlike autocomplete.get (capped at ~5
// suggestions) it returns every match JioSaavn is willing to give up in one page (up to ~40).
export async function searchSongs(query: string): Promise<SearchResult[]> {
  const response = await callApi<{ results?: RawSearchSong[] }>({
    __call: "search.getResults",
    q: query,
    p: "1",
    n: "40",
  });

  return (response.results ?? []).map((song) => ({
    id: song.id,
    title: decodeText(song.song),
    album: decodeText(song.album),
    artists: decodeText(song.singers || song.primary_artists),
    image: upscaleImage(song.image),
    url: song.perma_url,
  }));
}

export async function getLyrics(songId: string): Promise<string | null> {
  try {
    const response = await callApi<{ lyrics?: string }>({
      __call: "lyrics.getLyrics",
      ctx: "web6dot0",
      api_version: "4",
      lyrics_id: songId,
    });
    return response.lyrics ?? null;
  } catch {
    return null;
  }
}

// A playlist response already carries whole song objects, so one call yields playable tracks.
export async function getPlaylist(listId: string, limit?: number, revalidate?: number): Promise<Song[]> {
  const response = await callApi<{ songs?: RawSong[] }>(
    { __call: "playlist.getDetails", listid: listId },
    revalidate,
  );
  return (response.songs ?? []).slice(0, limit).map((song) => formatSong(song));
}

// One call resolves many ids at once; the result keeps the order that was asked for.
export async function getSongs(songIds: string[], revalidate?: number): Promise<Song[]> {
  if (songIds.length === 0) return [];
  const response = await callApi<Record<string, RawSong>>(
    { __call: "song.getDetails", pids: songIds.join(",") },
    revalidate,
  );
  return songIds
    .map((songId) => response[songId])
    .filter((song): song is RawSong => Boolean(song?.id))
    .map((song) => formatSong(song));
}

export async function getSong(songId: string, withLyrics = false): Promise<Song | null> {
  const response = await callApi<Record<string, RawSong>>({ __call: "song.getDetails", pids: songId });
  const song = response[songId];
  if (!song?.id) return null;

  const formatted = formatSong(song);
  if (!withLyrics) return formatted;
  return { ...formatted, lyrics: formatted.hasLyrics ? await getLyrics(songId) : null };
}

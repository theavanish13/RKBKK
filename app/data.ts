import { getPlaylist, getSongs, type Song } from "@/lib/jiosaavn";
import type { Entry } from "./player-context";

const NINETIES_PLAYLIST_ID = "3379491"; // JioSaavn's "Best Of 90s - Hindi"
const ONE_DAY = 60 * 60 * 24;

// Classic film mujras and ghazals, pinned to their original soundtrack recordings.
const MUJRA_SONG_IDS = [
  "H57N8ffP", // Dil Cheez Kya Hai — Umrao Jaan
  "OA00vPDf", // In Ankhon Ki Masti — Umrao Jaan
  "BpQCb2H1", // Salame-Ishq Meri Jaan — Muqaddar Ka Sikandar
  "4szHo8Cj", // Pyar Kiya To Darna Kya — Mughal-E-Azam
  "4-JerdN_", // Chalte Chalte Yun Hi Koi — Pakeezah
  "oFk6htiK", // Inhin Logon Ne — Pakeezah
  "3_45NDFz", // Yeh Kya Jagah Hai Doston — Umrao Jaan
  "4YTnC5DC", // Thare Rahiyo O Banke Yaar — Pakeezah
  "O9BYhERq", // Woh Chup Rahen To Mere — Jahanara
  "6wZo9QG5", // Tir-E-Nazar Dekhenge — Pakeezah
  "-S9Y-pVf", // Ada Qatil Nazar Barke-Bala — Gazal
  "TSF10Ry6", // Nazar Lagi Raja Tore Bangle Par — Kala Pani
  "3Nq2EcHF", // Sanam Tu Bewafa Ke Naam Se — Khilona
  "Wb5ydgbG", // Sakhiya Aaj Mujhe Neend Nahin — Sahib Bibi Aur Ghulam
  "fwZfnTWy", // Parde Mein Rahne Do — Shikar
  "EAxG3MU_", // Jhoomka Gira Re — Mera Saaya
  "LIf6aW5C", // Dola Re Dola — Devdas
  "bbZIGam2", // Maar Daala — Devdas
  "oz7kJFL1", // Silsila Ye Chahat Ka — Devdas
];

function toEntry(song: Song): Entry {
  return {
    id: song.id,
    title: song.title,
    album: song.album,
    artists: song.singers || song.artists,
    image: song.image,
    duration: song.duration,
    mediaUrl: song.mediaUrl,
  };
}

// A list renders empty rather than failing the whole page.
async function prefetch(load: () => Promise<Song[]>): Promise<Entry[]> {
  try {
    return (await load()).map(toEntry);
  } catch {
    return [];
  }
}

// Playlist and song-detail responses both carry a stream url, so every prefetched
// track plays on click without a second call.
export async function getEntries() {
  const [mujra, nineties] = await Promise.all([
    prefetch(() => getSongs(MUJRA_SONG_IDS, ONE_DAY)),
    prefetch(() => getPlaylist(NINETIES_PLAYLIST_ID, undefined, ONE_DAY)),
  ]);
  return { mujra, nineties };
}

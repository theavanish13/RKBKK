import { getPlaylist, getSongs, type Song } from "@/lib/jiosaavn";
import type { Entry } from "./player-context";

const NINETIES_PLAYLIST_ID = "3379491"; // JioSaavn's "Best Of 90s - Hindi"
const ONE_DAY = 60 * 60 * 24;

// Cued on first visit, before anyone has played anything. It belongs to neither curated
// list, so it's fetched on its own rather than looked up inside one of them.
const DEFAULT_SONG_ID = "0zDU-e5k"; // Jimmy Jimmy Jimmy Aaja — Disco Dancer

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
  "XQnxW-7y", // Aye Dil-E-Nadan (Full Version) — Razia Sultan
];

// A hidden rotation pool for radio mode. Never rendered anywhere — the ids stay on the
// server and only reach the browser one resolved song at a time, via /api/saavn/radio.
// Deliberately disjoint from the two visible playlists so idle playback explores past them.
export const RADIO_SONG_IDS = [
  "2fxrWwwV", // Nazar Ke Samne — Aashiqui
  "0C14rDAw", // Ab Tere Bin Jee Lenge Hum — Aashiqui
  "n0aqWuU7", // Main Duniya Bhula Doonga — Aashiqui
  "RETnhyj4", // Bas Ek Sanam Chahiye — Aashiqui
  "Q-0kn5ZO", // Dil Hai Ki Manta Nahin — Dil Hai Ke Manta Nahin
  "nAQZktG6", // O Mere Sapno Ke Saudagar — Dil Hai Ke Manta Nahin
  "pjW5k4WI", // Tu Pyar Hai Kisi Aur Ka — Dil Hai Ke Manta Nahin
  "kIJUXH6C", // Bahut Pyar Karte Hain — Saajan
  "7dkIM9KJ", // Tumse Milne Ki Tamanna Hai — Saajan
  "WPfOBHA6", // Jeeye To Jeeye Kaise — Saajan
  "pQteuALd", // Pehli Baar Mile Hain — Saajan
  "uPVFUwOm", // Sochenge Tumhe Pyar — Deewana
  "JY15hO0_", // Koi Na Koi Chahiye — Deewana
  "QLVFeFRo", // Yahan Ke Hum Sikandar — Jo Jeeta Wohi Sikandar
  "yaUg0eSj", // Chhupana Bhi Nahi Aata — Baazigar
  "UCUhPykA", // Kitabein Bahut Si — Baazigar
  "v7Xa1Kao", // Ae Mere Humsafar — Baazigar
  "9Cju9Dqv", // Mujhse Mohabbat Ka Izhaar — Hum Hain Rahi Pyar Ke
  "6avZlFIa", // Ruk Ruk Ruk — Vijaypath
  "c_UKjJL3", // Raah Mein Unse Mulaqat — Vijaypath
  "4QpUnKrD", // Kuchh Na Kaho — 1942 A Love Story
  "JtqrPs4h", // Rim Jhim Rim Jhim — 1942 A Love Story
  "C8xnYoYF", // Na Kajre Ki Dhar — Mohra
  "CGfOlner", // Ae Kaash Ke Hum — Kabhi Haan Kabhi Naa
  "Nmy6GT8s", // Paas Woh Aane Lage — Main Khiladi Tu Anari
  "ekoikZNB", // Tumsa Koi Pyaara — Khuddar
  "hD2YEuj5", // Sexy Sexy Mujhe Log Bole — Khuddar
  "F36LGV4y", // Raja Ko Rani Se Pyar Ho Gaya — Akele Hum Akele Tum
  "OGdwSivz", // Dil Kehta Hai — Akele Hum Akele Tum
  "UORRQ5fo", // Akele Hum Akele Tum — Akele Hum Akele Tum
  "niAkyGoW", // Kehna Hi Kya — Bombay
  "lbv8-53C", // Pardesi Pardesi — Raja Hindustani
  "0REFezIu", // Aaye Ho Meri Zindagi Mein — Raja Hindustani
  "lYSdgcg4", // Poocho Zara Poocho — Raja Hindustani
  "YFtsSibd", // Mera Chand Mujhe Aaya Hai Nazar — Mr Aashiq
  "2Eq1kDKg", // Chaahat Na Hoti — Chaahat
  "KLCgX51T", // O Lal Dupatte Wali — Aankhen
  "u9JwjeYa", // Ae Ajnabi — Dil Se
  "ZRJ1sIuW", // Satrangi Re — Dil Se
  "rtdvmBBB", // Kuch Kuch Hota Hai — Kuch Kuch Hota Hai
  "FOn06quY", // Ladki Badi Anjani Hai — Kuch Kuch Hota Hai
  "L3KovXg6", // Tujhe Yaad Na Meri Aayee — Kuch Kuch Hota Hai
  "jFerJMnc", // Koi Mil Gaya — Kuch Kuch Hota Hai
  "IZWPybKa", // Aankhon Se Tune Kya Keh Diya — Ghulam
  "sCpEmQ2o", // Aati Kya Khandala — Ghulam
  "qX3py555", // Jadoo Hai Tera Hi Jadoo — Ghulam
  "XsWvId5O", // Woh Ladki Jo — Baadshah
  "2jA0ih0d", // Hum To Deewane Huye — Baadshah
  "0CbxIl86", // Mera Mann — Mann
  "2rbCaNyi", // Tinak Tin Tana — Mann
  "dHnB7DzT", // Nimbooda — Hum Dil De Chuke Sanam
  "_cEv0AoD", // Aankhon Ki Gustakhiyan — Hum Dil De Chuke Sanam
  "xQQWBSr1", // Chand Chhupa Badal Mein — Hum Dil De Chuke Sanam
  "HVrcEzEk", // Tadap Tadap Ke — Hum Dil De Chuke Sanam
  "uDBy6HVI", // Dholi Taro Dhol Baaje — Hum Dil De Chuke Sanam
  "ajdDcg1a", // Ishq Bina — Taal
  "1or5fzpJ", // Ramta Jogi — Taal
  "fjlG6zD6", // Do Dil Mil Rahe Hain — Pardes
  "w8LT2jNx", // Sandese Aate Hain — Border
  "EkvSn2po", // To Chalun — Border
  "-Zm3YohH", // Main Koi Aisa Geet Gaoon — Yes Boss
  "2rng87ni", // Chaand Taare — Yes Boss
  "Xr7KV3x2", // Hoshwalon Ko Khabar Kya — Sarfarosh
  "g62EiRej", // Mitwa — Lagaan
  "uwPrF1hP", // O Rey Chhori — Lagaan
  "fGb1G7EX", // Radha Kaise Na Jale — Lagaan
  "nrt-2lCH", // Kaho Naa Pyaar Hai — Kaho Naa Pyar Hai
  "aTqp0hSh", // Na Tum Jaano Na Hum — Kaho Naa Pyar Hai
  "ixrMPG6M", // Aap Mujhe Achche Lagne Lage — Aap Mujhe Achche Lagne Lage
  "43tpU687", // Tere Naam — Tere Naam
  "aIrEbeSR", // Tumse Milna — Tere Naam
  "Hrp1k8Wr", // Odh Li Chunariya — Pyaar Kiya To Darna Kya
  "s91BiYcO", // Ajab Si — Om Shanti Om
  "keGNxOoV", // Main Agar Kahoon — Om Shanti Om
  "nQYSc7aJ", // Dard-E-Disco — Om Shanti Om
  "TfJX33Qk", // Kal Ho Naa Ho — Kal Ho Naa Ho
  "ZPt-0gYS", // Pretty Woman — Kal Ho Naa Ho
  "zNUldlfk", // Kuch To Hua Hai — Kal Ho Naa Ho
  "PwBT5PfN", // It's The Time To Disco — Kal Ho Naa Ho
  "IO0PsTBx", // Maahi Ve — Kal Ho Naa Ho
  "42OIsTLs", // Suraj Hua Maddham — Kabhi Khushi Kabhie Gham
  "5eDd4Xmt", // You Are My Soniya — Kabhi Khushi Kabhie Gham
  "7m9TJWCJ", // Bole Chudiyan — Kabhi Khushi Kabhie Gham
  "PFku0DuW", // Say Shava Shava — Kabhi Khushi Kabhie Gham
  "kuGLmxfQ", // Yeh Ladka Hai Allah — Kabhi Khushi Kabhie Gham
  "mfvkbvMu", // Aankhein Khuli — Mohabbatein
  "h1C-bImb", // Humko Humise Chura Lo — Mohabbatein
  "Ce8Ub84z", // Chalte Chalte — Mohabbatein
  "1nnqhygS", // Zara Zara — Rehnaa Hai Terre Dil Mein
  "DnDGD92L", // Sach Keh Raha Hai Deewana — Rehnaa Hai Terre Dil Mein
  "ySbdWaiT", // Dil Ko Tumse Pyaar Hua — Rehnaa Hai Terre Dil Mein
  "ZO6tBK6N", // Kaise Mujhe — Ghajini
  "DmFM4XiZ", // Guzarish — Ghajini
  "qNJjVi9V", // Behka — Ghajini
  "QRfQrIA9", // Tu Hi Meri Shab Hai — Gangster
  "lFFOrxJJ", // Bheegi Bheegi — Gangster
  "VUAKKvxj", // Ya Ali — Gangster
  "Lvb8dmra", // Mujhe Mat Roko — Murder
  "ZRo2WIGA", // Kaho Na Kaho — Murder
  "zm7fYozG", // Jadu Hai Nasha Hai — Jism
  "HPKNWfJA", // Awaarapan Banjarapan — Jism
  "kVDb23_i", // Chalo Tumko Lekar — Jism
  "E72zWT1L", // Woh Lamhe Woh Baatein — Zeher
  "MqUkNStK", // Agar Tum Mil Jao — Zeher
  "WiLFvhYp", // Tu Hi Haqeeqat — Tum Mile
  "no4U0SP0", // Dil Ibaadat — Tum Mile
  "M-BVuOgY", // Is Jahaan Mein — Tum Mile
  "QFLyDVyf", // Tum Mile — Tum Mile
  "VQp1eXug", // Zara Sa — Jannat
  "tEu-1E8r", // Haan Tu Hain — Jannat
  "vIlO8uHc", // Jannat Jahan — Jannat
  "vYpen8x-", // Judaai — Jannat
  "Bgmqpxmt", // Tera Hone Laga Hoon — Ajab Prem Ki Ghazab Kahani
  "4pmA4p6Q", // Aa Jao Meri Tamanna — Ajab Prem Ki Ghazab Kahani
  "8GfT0Z_L", // Main Tera Dhadkan Teri — Ajab Prem Ki Ghazab Kahani
  "8fPg_mQR", // Tujh Mein Rab Dikhta Hai — Rab Ne Bana Di Jodi
  "T1_ZbnIF", // Haule Haule — Rab Ne Bana Di Jodi
  "sKaLXx-d", // Phir Milenge Chalte Chalte — Rab Ne Bana Di Jodi
  "qOsPYZbc", // Dance Pe Chance — Rab Ne Bana Di Jodi
  "XxBmex2S", // Aao Milo Chalo — Jab We Met
  "zIPKC8PK", // Tum Se Hi — Jab We Met
  "xh7WFoR8", // Yeh Ishq Hai — Jab We Met
  "_n4E8z9a", // Mauja Hi Mauja — Jab We Met
  "izo8AG5O", // Aaoge Jab Tum — Jab We Met
  "SVLYcqv6", // In Dino — Life In A Metro
  "13akR5wJ", // Alvida — Life In A Metro
  "cHPJ61pU", // O Meri Jaan — Life In A Metro
  "uocGdzJy", // Baatein Kuch Ankahee Si — Life In A Metro (Unplugged)
  "FC63n6XV", // Kya Mujhe Pyaar Hai — Woh Lamhe
  "lOXQ3NlM", // Dholna — Heyy Babyy
  "ATV7oJXH", // Mast Kalandar — Heyy Babyy
  "JrPL9DhO", // Jaane Kyun — Dostana
  "gWV5HniX", // Desi Girl — Dostana
  "TjYINhmo", // Khabar Nahi — Dostana
  "7Xbj5KkB", // Maa Da Laadla — Dostana
  "5nibc0pd", // Aankhon Mein Neendein — We Are Family
  "AkK-XgaX", // Dil Khol Ke Let's Rock — We Are Family
  "llxluOsu", // Pee Loon — Once Upon A Time In Mumbaai
  "pYKoawz_", // Tum Jo Aaye — Once Upon A Time In Mumbaai
  "bIAmZceU", // I Am In Love — Once Upon A Time In Mumbaai
  "8fVK9jXK", // Tujhe Bhula Diya — Anjaana Anjaani
  "ilYPJCUZ", // Anjaana Anjaani Ki Kahani — Anjaana Anjaani
  "8weYfjNG", // Hairat — Anjaana Anjaani
  "TXsCwJhg", // Kya Karoon — Wake Up Sid
  "3Be_U0qz", // Iktara — Wake Up Sid
  "ce2nW4DG", // Aaj Kal Zindagi — Wake Up Sid
  "7Jd6imhH", // Rehna Tu — Delhi 6
  "t7_tAmJv", // Masakali — Delhi 6
  "XnwenJqr", // Arziyan — Delhi 6
  "sWr9xfaD", // Tu Bin Bataye — Rang De Basanti
  "m3oSq17q", // Khalbali — Rang De Basanti
  "tdhrN_9I", // Roobaroo — Rang De Basanti
  "1a_MxvYZ", // Luka Chuppi — Rang De Basanti
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
  const [mujra, nineties, defaultSong] = await Promise.all([
    prefetch(() => getSongs(MUJRA_SONG_IDS, ONE_DAY)),
    prefetch(() => getPlaylist(NINETIES_PLAYLIST_ID, undefined, ONE_DAY)),
    prefetch(() => getSongs([DEFAULT_SONG_ID], ONE_DAY)),
  ]);
  return { mujra, nineties, defaultEntry: defaultSong[0] ?? null };
}

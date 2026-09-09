"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

export type Entry = {
  id: string;
  title: string;
  album: string;
  artists: string;
  image: string;
  duration: number;
  mediaUrl?: string;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function describe(entry: Entry) {
  return [entry.artists, entry.album].filter(Boolean).join(" · ");
}

// Search results arrive without a stream url; song details fill it in on demand.
async function resolveEntry(entry: Entry): Promise<Entry | null> {
  try {
    const response = await fetch(`/api/saavn/song?id=${encodeURIComponent(entry.id)}`);
    const payload = await response.json();
    if (!response.ok) return null;
    return {
      ...entry,
      title: payload.song.title,
      album: payload.song.album,
      artists: payload.song.singers || payload.song.artists,
      image: payload.song.image,
      duration: payload.song.duration,
      mediaUrl: payload.song.mediaUrl,
    };
  } catch {
    return null;
  }
}

function SkipIcon({ direction }: { direction: 1 | -1 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <g transform={direction === 1 ? undefined : "scale(-1 1) translate(-24 0)"}>
        <path d="M6.5 6.9 15 12l-8.5 5.1Z" />
        <path d="M17.5 6.6v10.8" />
      </g>
    </svg>
  );
}

function PlayIcon({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {isPlaying ? (
        <>
          <rect x="7.6" y="5.4" width="3.4" height="13.2" rx="1.2" />
          <rect x="13" y="5.4" width="3.4" height="13.2" rx="1.2" />
        </>
      ) : (
        <path d="M8.8 5.3 19 12 8.8 18.7Z" />
      )}
    </svg>
  );
}

function TrackRow({
  entry,
  position,
  isActive,
  isPlaying,
  isLoading,
  onPlay,
}: {
  entry: Entry;
  position: number;
  isActive: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      className={`grid w-full cursor-pointer grid-cols-[22px_34px_minmax(0,1fr)_auto] items-center gap-2.5 border-0 bg-transparent px-[11px] py-1.5 text-left text-ink transition-colors duration-[180ms] hover:bg-white/14 ${isActive ? "bg-white/20" : ""}`}
      type="button"
      onClick={onPlay}
      aria-label={`Play ${entry.title}`}
    >
      <span className="font-mono text-[10px] text-white/60">{String(position + 1).padStart(2, "0")}</span>
      <Image className="rounded-[3px] object-cover" src={entry.image} alt="" width={34} height={34} unoptimized />
      <span className="grid min-w-0 gap-0.5">
        <span className={`overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold ${isActive ? "text-orange" : "text-white"}`}>
          {entry.title}
        </span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-white/60">{describe(entry)}</span>
      </span>
      <span className="font-mono text-[10px] text-white/60">
        {isLoading ? "···" : isActive && isPlaying ? "▮▮▮" : entry.duration ? formatTime(entry.duration) : "▶"}
      </span>
    </button>
  );
}

const INITIAL_VISIBLE = 12;
const LOAD_MORE_STEP = 10;

// Renders a growing prefix of a long list, revealing more once a sentinel placed after the
// visible rows scrolls into view. An IntersectionObserver (rather than an onScroll listener
// on the panel itself) keeps this working whether the panel scrolls internally (desktop) or
// the whole page does (the mobile layout switches the panel to overflow-visible).
function useLoadMoreOnScroll(total: number) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(INITIAL_VISIBLE, total));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((count) => Math.min(count + LOAD_MORE_STEP, total));
      },
      { rootMargin: "48px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [total]);

  return [visibleCount, sentinelRef] as const;
}

// Shared first-visit default — every new listener starts here until they've played something.
const DEFAULT_ENTRY_ID = "BpQCb2H1"; // Salame-Ishq Meri Jaan
const LAST_PLAYED_STORAGE_KEY = "rkbkk:last-played";

export default function Player({ mujra, nineties }: { mujra: Entry[]; nineties: Entry[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playTokenRef = useRef(0);
  const retriedIdRef = useRef<string | null>(null);
  // The zone (queue + position) playback was in before switching to a different list,
  // so a short list (e.g. search results) can hand playback back instead of looping itself.
  const previousZoneRef = useRef<{ list: Entry[]; index: number } | null>(null);

  const defaultIndex = mujra.findIndex((entry) => entry.id === DEFAULT_ENTRY_ID);
  const [queue, setQueue] = useState<Entry[]>(() => (defaultIndex === -1 ? [] : mujra));
  const [index, setIndex] = useState<number | null>(() => (defaultIndex === -1 ? null : defaultIndex));
  const [results, setResults] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [message, setMessage] = useState("");

  const current = index === null ? null : queue[index] ?? null;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const startPlayback = useCallback((entry: Entry) => {
    const audio = audioRef.current;
    if (!audio || !entry.mediaUrl) return;
    audio.src = entry.mediaUrl;
    setCurrentTime(0);
    setDuration(entry.duration);
    audio.play().catch(() => setMessage(`"${entry.title}" could not be played.`));
  }, []);

  // Cues a track as "current" without playing it — browsers block unprompted autoplay
  // anyway, so the initial/restored selection loads paused until the user presses play.
  const loadEntry = useCallback((entry: Entry) => {
    const audio = audioRef.current;
    if (!audio || !entry.mediaUrl) return;
    audio.src = entry.mediaUrl;
    setCurrentTime(0);
    setDuration(entry.duration);
  }, []);

  // Restore whatever the listener last played, falling back to the shared default
  // (already selected via initial state) when there's no saved track, or it's gone.
  // The state updates are deferred into a microtask so this reads as reacting to an
  // external event (mount) rather than the effect synchronously driving its own state.
  useEffect(() => {
    queueMicrotask(() => {
      if (current) loadEntry(current);

      try {
        const raw = localStorage.getItem(LAST_PLAYED_STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Entry;
        if (!saved?.id || saved.id === current?.id) return;

        const inMujra = mujra.findIndex((entry) => entry.id === saved.id);
        const inNineties = nineties.findIndex((entry) => entry.id === saved.id);

        if (inMujra !== -1) {
          setQueue(mujra);
          setIndex(inMujra);
          loadEntry(mujra[inMujra]);
        } else if (inNineties !== -1) {
          setQueue(nineties);
          setIndex(inNineties);
          loadEntry(nineties[inNineties]);
        } else if (saved.mediaUrl) {
          setQueue([saved]);
          setIndex(0);
          loadEntry(saved);
        }
      } catch {
        // Corrupt or inaccessible storage: keep the default selection.
      }
    });
    // Runs once on mount to seed/restore the initial selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remembers whatever is current so it can be re-selected on the next visit.
  useEffect(() => {
    if (!current) return;
    try {
      localStorage.setItem(LAST_PLAYED_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // localStorage may be unavailable (private browsing, quota) - not critical.
    }
  }, [current]);

  const playAt = useCallback(
    async (list: Entry[], position: number) => {
      const entry = list[position];
      if (!entry) return;

      // Switching to a different list mid-playback: remember where we were so that list
      // can resume once this one runs out, instead of the new list looping on its own.
      if (index !== null && list !== queue) {
        previousZoneRef.current = { list: queue, index };
      }

      const token = ++playTokenRef.current;
      retriedIdRef.current = null;
      setQueue(list);
      setIndex(position);
      setMessage("");

      if (entry.mediaUrl) {
        startPlayback(entry);
        return;
      }

      setLoadingId(entry.id);
      const resolved = await resolveEntry(entry);
      if (playTokenRef.current !== token) return;
      setLoadingId(null);

      if (!resolved) {
        setMessage(`"${entry.title}" could not be loaded.`);
        return;
      }
      setQueue((current) => current.map((item, itemIndex) => (itemIndex === position ? resolved : item)));
      startPlayback(resolved);
    },
    [startPlayback, queue, index],
  );

  function skip(direction: 1 | -1) {
    if (index === null || queue.length === 0) return;
    void playAt(queue, (index + direction + queue.length) % queue.length);
  }

  // A track ending naturally shouldn't loop a short list (e.g. search results) forever:
  // play on through the rest of the current list, then hand back to whatever zone was
  // interrupted to get here. Only once there's nowhere left to return to does it loop.
  function handleEnded() {
    if (index === null || queue.length === 0) return;

    if (index + 1 < queue.length) {
      void playAt(queue, index + 1);
      return;
    }

    const previousZone = previousZoneRef.current;
    if (previousZone) {
      previousZoneRef.current = null;
      void playAt(previousZone.list, Math.min(previousZone.index + 1, previousZone.list.length - 1));
      return;
    }

    void playAt(queue, 0);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !current?.mediaUrl) return;
    if (isPlaying) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setMessage("Playback was blocked by the browser.");
    }
  }

  // CDN links are long lived but not permanent, so refresh one before giving up.
  const recoverPlayback = useCallback(async () => {
    if (!current || retriedIdRef.current === current.id) return;
    retriedIdRef.current = current.id;

    const refreshed = await resolveEntry({ ...current, mediaUrl: undefined });
    if (!refreshed) {
      setMessage(`"${current.title}" is no longer streamable.`);
      return;
    }
    setQueue((currentQueue) => currentQueue.map((item) => (item.id === refreshed.id ? refreshed : item)));
    startPlayback(refreshed);
  }, [current, startPlayback]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setMessage("");
    try {
      const response = await fetch(`/api/saavn/search?q=${encodeURIComponent(trimmedQuery)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);

      setResults(payload.results.map((result: Omit<Entry, "duration">) => ({ ...result, duration: 0 })));
      if (payload.results.length === 0) setMessage(`Sorry, we have nothing for "${trimmedQuery}".`);
    } catch {
      setResults([]);
      setMessage("Search failed. Try again in a moment.");
    } finally {
      setIsSearching(false);
    }
  }

  function seek(event: React.ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    if (audioRef.current) audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  // `visibleCount` only trims how many rows render — `list` and `position` still refer to
  // the full underlying playlist, so playback (and auto-advance through it) isn't limited
  // to whatever happens to be scrolled into view.
  function renderRows(list: Entry[], visibleCount: number = list.length) {
    return list.slice(0, visibleCount).map((entry, position) => (
      <TrackRow
        key={`${entry.id}-${position}`}
        entry={entry}
        position={position}
        isActive={current?.id === entry.id}
        isPlaying={isPlaying}
        isLoading={loadingId === entry.id}
        onPlay={() => void playAt(list, position)}
      />
    ));
  }

  const [mujraVisible, mujraSentinelRef] = useLoadMoreOnScroll(mujra.length);
  const [ninetiesVisible, ninetiesSentinelRef] = useLoadMoreOnScroll(nineties.length);

  return (
    <main className="grid h-[100svh] min-h-[560px] grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden bg-[linear-gradient(90deg,rgba(10,13,11,.82),rgba(10,13,11,.42)),url('/rr99la.png')] bg-cover bg-center bg-no-repeat px-[6vw] max-[860px]:min-h-[500px] max-[860px]:px-[22px]">
      <audio
        ref={audioRef}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onError={() => void recoverPlayback()}
      />

      <header className="flex items-center justify-between border-0 py-[15px] font-mono text-[10px] font-medium tracking-[.12em] max-[860px]:py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-[25px] w-[25px] place-items-center rounded-full border border-ink font-serif text-sm font-semibold tracking-normal">R</span>
          <span>ROOM 205 / AUDIO</span>
        </div>
        <span className="text-white/62 max-[860px]:hidden">
          <span className="mr-[7px] inline-block h-1.5 w-1.5 rounded-full bg-[#73965c]" /> Streaming via RKBKK
        </span>
      </header>

      <section className="grid min-h-0 grid-cols-[310px_minmax(0,1fr)_310px] gap-5 py-3.5 pb-4 max-[860px]:flex max-[860px]:flex-col max-[860px]:gap-3.5 max-[860px]:overflow-y-auto max-[860px]:py-1 max-[860px]:pb-3">
        <aside className="min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/20 max-[860px]:overflow-visible">
          <div className="min-h-full border border-[rgba(255,244,229,.12)] bg-[rgba(8,12,10,.38)] pb-[5px] max-[860px]:min-h-0">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-[rgba(8,12,10,.92)] px-[11px] py-[9px]">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[.14em] text-orange">Mujra playlist</span>
            </div>
            {mujra.length > 0 ? renderRows(mujra, mujraVisible) : <p className="m-0 px-[11px] py-[13px] font-mono text-[10px] text-white/55">Mujra picks are unavailable.</p>}
            {mujraVisible < mujra.length && <div ref={mujraSentinelRef} aria-hidden="true" />}
          </div>
        </aside>

        <div className="grid min-h-0 content-start gap-3.5 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/20 max-[860px]:order-first max-[860px]:overflow-visible">
          <div className="flex flex-col items-center pt-1 pb-1.5 text-white max-[860px]:pt-0.5 max-[860px]:pb-2">
            <h1 className="m-0 text-center text-[clamp(42px,6.6vw,96px)] font-extrabold leading-[.86] tracking-[.08em] text-white [text-shadow:0_4px_28px_rgba(0,0,0,.45)] max-[860px]:text-[clamp(38px,13vw,62px)]">
              KOTHA
            </h1>
            <form className="mt-4 flex w-[min(430px,84vw)] items-center gap-2 max-[860px]:mt-3" onSubmit={search} role="search">
              <input
                className="min-w-0 flex-1 rounded-full border border-line bg-[rgba(8,12,10,.46)] px-4 py-2.5 text-xs text-white outline-none placeholder:text-white/50 focus:border-orange max-[860px]:px-3.5 max-[860px]:py-2 max-[860px]:text-[11px]"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a song"
                aria-label="Search a song"
              />
              <button
                className="cursor-pointer rounded-full border-0 bg-orange px-[18px] py-2.5 text-xs font-bold text-white transition-colors duration-200 hover:enabled:bg-[#f07f55] disabled:cursor-not-allowed disabled:opacity-[.45] max-[860px]:px-3.5 max-[860px]:py-2 max-[860px]:text-[11px]"
                type="submit"
                disabled={isSearching || !query.trim()}
              >
                {isSearching ? "···" : "Search"}
              </button>
            </form>
            {message && <p className="mt-3 mb-0 font-mono text-[11px] text-[#ffc09d]" role="status">{message}</p>}
          </div>

          {results.length > 0 && (
            <div className="border border-[rgba(255,244,229,.12)] bg-[rgba(8,12,10,.38)] pb-[5px]">
              <div className="sticky top-0 z-10 flex items-center justify-between bg-[rgba(8,12,10,.92)] px-[11px] py-[9px]">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[.14em] text-orange">Results</span>
                <button
                  className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[.1em] text-white/62 hover:text-orange"
                  type="button"
                  onClick={() => setResults([])}
                >
                  Clear
                </button>
              </div>
              {renderRows(results)}
            </div>
          )}
        </div>

        <aside className="min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/20 max-[860px]:overflow-visible">
          <div className="min-h-full border border-[rgba(255,244,229,.12)] bg-[rgba(8,12,10,.38)] pb-[5px] max-[860px]:min-h-0">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-[rgba(8,12,10,.92)] px-[11px] py-[9px]">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[.14em] text-orange">90s picks</span>
            </div>
            {nineties.length > 0 ? renderRows(nineties, ninetiesVisible) : <p className="m-0 px-[11px] py-[13px] font-mono text-[10px] text-white/55">RKBKK picks are unavailable.</p>}
            {ninetiesVisible < nineties.length && <div ref={ninetiesSentinelRef} aria-hidden="true" />}
          </div>
        </aside>
      </section>

      <section
        className="grid grid-cols-[minmax(0,1.5fr)_auto_minmax(0,2fr)_auto] items-center gap-[22px] border-t border-[rgba(255,244,229,.12)] bg-[rgba(8,12,10,.42)] py-3.5 pb-4 max-[860px]:grid-cols-[minmax(0,1fr)_auto] max-[860px]:gap-3 max-[860px]:py-2.5 max-[860px]:pb-3"
        aria-label="Audio player"
      >
        <div className="grid min-w-0 grid-cols-[46px_minmax(0,1fr)] items-center gap-3">
          {current ? (
            <Image className="rounded object-cover" src={current.image} alt="" width={46} height={46} unoptimized />
          ) : (
            <span className="block h-[46px] w-[46px] rounded border border-line" aria-hidden="true" />
          )}
          <span className="grid min-w-0 gap-[3px]">
            <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-white">
              {current ? current.title : "Nothing playing"}
            </strong>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-white/62">
              {current ? describe(current) : "Search a song or pick one from the 90s"}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-center gap-5 max-[860px]:gap-3.5">
          <button
            className="grid cursor-pointer place-items-center border-0 p-0 text-white/92 transition-[transform,opacity] duration-[180ms] enabled:hover:scale-110 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-[.45] h-7 w-7 rounded-md max-[860px]:h-6 max-[860px]:w-6 [&_svg]:h-[21px] [&_svg]:w-[21px] max-[860px]:[&_svg]:h-[18px] max-[860px]:[&_svg]:w-[18px]"
            type="button"
            onClick={() => skip(-1)}
            disabled={!current}
            aria-label="Previous track"
          >
            <SkipIcon direction={-1} />
          </button>
          <button
            className="grid h-[58px] w-[58px] cursor-pointer place-items-center rounded-full border-0 bg-white p-0 text-[#16191b] shadow-[0_9px_20px_rgba(0,0,0,.32)] transition-[transform,opacity] duration-[180ms] enabled:hover:scale-105 disabled:cursor-not-allowed disabled:text-[#8b9096] disabled:shadow-[0_6px_14px_rgba(0,0,0,.22)] max-[860px]:h-11 max-[860px]:w-11 [&_svg]:h-[23px] [&_svg]:w-[23px] max-[860px]:[&_svg]:h-[19px] max-[860px]:[&_svg]:w-[19px]"
            type="button"
            onClick={togglePlayback}
            disabled={!current?.mediaUrl}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <PlayIcon isPlaying={isPlaying} />
          </button>
          <button
            className="grid cursor-pointer place-items-center border-0 p-0 text-white/92 transition-[transform,opacity] duration-[180ms] enabled:hover:scale-110 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-[.45] h-7 w-7 rounded-md max-[860px]:h-6 max-[860px]:w-6 [&_svg]:h-[21px] [&_svg]:w-[21px] max-[860px]:[&_svg]:h-[18px] max-[860px]:[&_svg]:w-[18px]"
            type="button"
            onClick={() => skip(1)}
            disabled={!current}
            aria-label="Next track"
          >
            <SkipIcon direction={1} />
          </button>
        </div>
        <div className="flex items-center gap-2.5 font-mono text-[10px] text-white/72 max-[860px]:col-span-full max-[860px]:row-start-2">
          <span>{formatTime(currentTime)}</span>
          <input
            className="h-[3px] flex-1 cursor-pointer accent-orange disabled:cursor-not-allowed"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            onChange={seek}
            disabled={!current?.mediaUrl}
            aria-label="Seek through track"
          />
          <span>{formatTime(duration)}</span>
        </div>
        <label className="flex items-center gap-2 font-mono text-[10px] text-white/72 max-[860px]:col-span-full">
          <span>VOL</span>
          <input
            className="h-[3px] w-16 cursor-pointer accent-orange"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
          />
        </label>
      </section>

      <footer className="flex items-center justify-between border-0 py-[15px] font-mono text-[10px] font-medium tracking-[.12em] text-white/60 max-[860px]:gap-3 max-[860px]:py-[10px] max-[860px]:text-[8px] max-[860px]:leading-[1.4]">
        <span>RKBKK AUDIO</span>
        <span>Song data &amp; audio via RKBKK</span>
      </footer>
    </main>
  );
}

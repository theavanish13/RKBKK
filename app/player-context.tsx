"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useOnlineCount } from "./use-online-count";

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

export function TrackRow({
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
      className={`grid w-full cursor-pointer grid-cols-[22px_34px_minmax(0,1fr)_auto] items-center gap-2.5 border-0 bg-transparent px-[11px] py-1.5 text-left text-ink transition-colors duration-[180ms] hover:bg-white/14 max-[860px]:py-2 ${isActive ? "bg-white/20" : ""}`}
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
export function useLoadMoreOnScroll(total: number) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(INITIAL_VISIBLE, total));
  // A ref callback (not a plain ref object) so the effect re-attaches whenever the sentinel
  // mounts — including when it appears later, e.g. a playlist accordion opening after the
  // list (and its sentinel) start out unmounted.
  const [sentinelNode, sentinelRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinelNode) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((count) => Math.min(count + LOAD_MORE_STEP, total));
      },
      { rootMargin: "48px" },
    );
    observer.observe(sentinelNode);
    return () => observer.disconnect();
  }, [sentinelNode, total]);

  return [visibleCount, sentinelRef] as const;
}

// A bar that expands in place to reveal a playlist's full track list, instead of navigating
// away — used on narrow screens where showing every playlist inline at once overlaps.
// `isOpen`/`onToggle` are lifted to the caller so only one accordion can be open at a time.
export function PlaylistAccordion({
  title,
  list,
  emptyMessage,
  isOpen,
  onToggle,
  className = "",
}: {
  title: string;
  list: Entry[];
  emptyMessage: string;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { current, isPlaying, loadingId, playAt } = usePlayer();
  const [visible, sentinelRef] = useLoadMoreOnScroll(list.length);
  // A marker pinned above the bar: once it scrolls out of the panel's clipped view the bar is
  // stuck, which is exactly when it needs a backdrop to stay readable over the rows passing
  // beneath it. A collapsed panel is only as tall as its bar, so it never sticks — and so
  // never darkens.
  const [topMarker, topMarkerRef] = useState<HTMLDivElement | null>(null);
  const [isStuck, setIsStuck] = useState(false);
  const image = list[0]?.image;

  useEffect(() => {
    if (!topMarker) return;
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting));
    observer.observe(topMarker);
    return () => observer.disconnect();
  }, [topMarker]);

  if (list.length === 0) {
    return (
      <div className={`rounded border border-[rgba(255,244,229,.12)] px-[11px] py-3 ${className}`}>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[.14em] text-orange">{title}</span>
        <p className="m-0 mt-1 font-mono text-[10px] text-white/55">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`rounded border border-[rgba(255,244,229,.12)] ${className}`}>
      <div ref={topMarkerRef} className="h-px" aria-hidden="true" />
      <button
        type="button"
        onClick={onToggle}
        className={`sticky top-0 z-10 flex w-full items-center justify-between gap-3 px-[11px] py-3 text-left text-ink transition-colors duration-200 [text-shadow:0_1px_5px_rgba(0,0,0,.85)] ${isStuck ? "rounded-t bg-[rgba(8,12,10,.92)]" : ""}`}
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {image && <Image className="rounded-[3px] object-cover" src={image} alt="" width={34} height={34} unoptimized />}
          <span className="grid min-w-0 gap-0.5">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[.14em] text-orange">{title}</span>
            <span className="font-mono text-[10px] text-white/60">{list.length} tracks</span>
          </span>
        </span>
        <span aria-hidden="true" className={`font-mono text-sm text-white/60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-[rgba(255,244,229,.12)] pb-[5px]">
          {list.slice(0, visible).map((entry, position) => (
            <TrackRow
              key={`${entry.id}-${position}`}
              entry={entry}
              position={position}
              isActive={current?.id === entry.id}
              isPlaying={isPlaying}
              isLoading={loadingId === entry.id}
              onPlay={() => void playAt(list, position)}
            />
          ))}
          {visible < list.length && <div ref={sentinelRef} aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}

type PlayerContextValue = {
  mujra: Entry[];
  nineties: Entry[];
  queue: Entry[];
  current: Entry | null;
  isPlaying: boolean;
  loadingId: string | null;
  playAt: (list: Entry[], position: number) => Promise<void>;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
}

// Shared first-visit default — every new listener starts here until they've played something.
const DEFAULT_ENTRY_ID = "BpQCb2H1"; // Salame-Ishq Meri Jaan
const LAST_PLAYED_STORAGE_KEY = "rkbkk:last-played";

// Owns playback (audio element, queue, controls) and renders the app chrome — header,
// now-playing bar, footer — around whatever page is currently routed into `children`.
// Living in the root layout keeps the <audio> element mounted across navigation, so
// switching between the home page and a full-page playlist view never interrupts playback.
export function PlayerProvider({ mujra, nineties, children }: { mujra: Entry[]; nineties: Entry[]; children: ReactNode }) {
  const onlineCount = useOnlineCount();
  const audioRef = useRef<HTMLAudioElement>(null);
  const playTokenRef = useRef(0);
  const retriedIdRef = useRef<string | null>(null);
  // The zone (queue + position) playback was in before switching to a different list,
  // so a short list (e.g. search results) can hand playback back instead of looping itself.
  const previousZoneRef = useRef<{ list: Entry[]; index: number } | null>(null);

  const defaultIndex = mujra.findIndex((entry) => entry.id === DEFAULT_ENTRY_ID);
  const [queue, setQueue] = useState<Entry[]>(() => (defaultIndex === -1 ? [] : mujra));
  const [index, setIndex] = useState<number | null>(() => (defaultIndex === -1 ? null : defaultIndex));
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

  function seek(event: React.ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    if (audioRef.current) audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <PlayerContext.Provider value={{ mujra, nineties, queue, current, isPlaying, loadingId, playAt }}>
      <main className="grid h-[100svh] min-h-[560px] grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden bg-[linear-gradient(90deg,rgba(10,13,11,.82),rgba(10,13,11,.42)),url('/SB.png')] bg-cover bg-center bg-no-repeat px-[6vw] max-[860px]:min-h-[500px] max-[860px]:px-[max(22px,env(safe-area-inset-left))_max(22px,env(safe-area-inset-right))]">
        <audio
          ref={audioRef}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onError={() => void recoverPlayback()}
        />

        <header className="flex items-center justify-between border-0 py-[15px] font-mono text-[10px] font-medium tracking-[.12em] max-[860px]:pt-[max(12px,env(safe-area-inset-top))] max-[860px]:pb-3">
          <div className="flex items-center gap-3">
            <span className="grid h-[25px] w-[25px] place-items-center rounded-full border border-ink font-serif text-sm font-semibold tracking-normal">R</span>
            <span>ROOM 205 / AUDIO</span>
          </div>
          {/* The static tagline stays desktop-only, but a live count is worth the header room on mobile. */}
          <span className={`text-white/62 ${onlineCount === null ? "max-[860px]:hidden" : ""}`}>
            <span className="mr-[7px] inline-block h-1.5 w-1.5 rounded-full bg-[#73965c]" />
            {onlineCount === null ? (
              "Streaming via RKBKK"
            ) : (
              <span className="whitespace-nowrap text-[12px] font-semibold text-white max-[860px]:text-[11px]">
                {onlineCount} listening now
              </span>
            )}
          </span>
        </header>

        {children}

        <section
          className="grid grid-cols-[minmax(0,1.5fr)_auto_minmax(0,2fr)_auto] items-center gap-[22px] rounded-2xl border border-[rgba(255,244,229,.12)] bg-[rgba(8,12,10,.42)] px-5 py-3.5 pb-4 max-[860px]:grid-cols-[minmax(0,1fr)_auto] max-[860px]:gap-3 max-[860px]:px-3.5 max-[860px]:py-2.5 max-[860px]:pb-3"
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
              <span
                className={`overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] ${message ? "text-[#ffc09d]" : "text-white/62"}`}
                role={message ? "status" : undefined}
              >
                {message || (current ? describe(current) : "Search a song or pick one from the 90s")}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-center gap-5 max-[860px]:gap-3.5">
            <button
              className="grid cursor-pointer place-items-center border-0 p-0 text-white/92 transition-[transform,opacity] duration-[180ms] enabled:hover:scale-110 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-[.45] h-7 w-7 rounded-md max-[860px]:h-9 max-[860px]:w-9 [&_svg]:h-[21px] [&_svg]:w-[21px] max-[860px]:[&_svg]:h-5 max-[860px]:[&_svg]:w-5"
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
              className="grid cursor-pointer place-items-center border-0 p-0 text-white/92 transition-[transform,opacity] duration-[180ms] enabled:hover:scale-110 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-[.45] h-7 w-7 rounded-md max-[860px]:h-9 max-[860px]:w-9 [&_svg]:h-[21px] [&_svg]:w-[21px] max-[860px]:[&_svg]:h-5 max-[860px]:[&_svg]:w-5"
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
              className="h-[3px] flex-1 cursor-pointer accent-orange disabled:cursor-not-allowed max-[860px]:h-6"
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
          <label className="flex items-center gap-2 font-mono text-[10px] text-white/72 max-[860px]:hidden">
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

        <footer className="flex items-center justify-between border-0 py-[15px] font-mono text-[10px] font-medium tracking-[.12em] text-white/60 max-[860px]:gap-3 max-[860px]:pt-[10px] max-[860px]:pb-[max(10px,env(safe-area-inset-bottom))] max-[860px]:text-[8px] max-[860px]:leading-[1.4]">
          <span>RKBKK AUDIO</span>
          <span>Song data &amp; audio via RKBKK</span>
        </footer>
      </main>
    </PlayerContext.Provider>
  );
}

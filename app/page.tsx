"use client";

import { FormEvent, useState } from "react";
import { PlaylistAccordion, TrackRow, useLoadMoreOnScroll, usePlayer, type Entry } from "./player-context";

export default function Home() {
  const { mujra, nineties, current, isPlaying, loadingId, playAt } = usePlayer();
  const [results, setResults] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  // Only one playlist accordion can be open on mobile at a time.
  const [expandedPlaylist, setExpandedPlaylist] = useState<"mujra" | "nineties" | null>(null);

  const [mujraVisible, mujraSentinelRef] = useLoadMoreOnScroll(mujra.length);
  const [ninetiesVisible, ninetiesSentinelRef] = useLoadMoreOnScroll(nineties.length);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setSearchMessage("");
    try {
      const response = await fetch(`/api/saavn/search?q=${encodeURIComponent(trimmedQuery)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);

      setResults(payload.results.map((result: Omit<Entry, "duration">) => ({ ...result, duration: 0 })));
      if (payload.results.length === 0) setSearchMessage(`Sorry, we have nothing for "${trimmedQuery}".`);
    } catch {
      setResults([]);
      setSearchMessage("Search failed. Try again in a moment.");
    } finally {
      setIsSearching(false);
    }
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

  return (
    <section className="grid min-h-0 grid-cols-[310px_minmax(0,1fr)_310px] grid-rows-[auto_minmax(0,1fr)] gap-x-5 gap-y-3.5 py-3.5 pb-4 max-[860px]:flex max-[860px]:flex-col max-[860px]:gap-3.5 max-[860px]:overflow-y-auto max-[860px]:pt-0 max-[860px]:pb-3">
      <div className="col-start-2 row-start-1 flex flex-col items-center pt-1 pb-1.5 text-white max-[860px]:shrink-0 max-[860px]:pt-0.5 max-[860px]:pb-2">
        <h1 className="m-0 pt-10 text-center text-[clamp(22px,2.9vw,46px)] font-extrabold leading-[.86] tracking-[.08em] text-white [text-shadow:0_4px_28px_rgba(0,0,0,.45)] max-[860px]:text-[clamp(24px,7vw,38px)]">
          SARASWATI BAND
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
        {searchMessage && <p className="mt-3 mb-0 font-mono text-[11px] text-[#ffc09d]" role="status">{searchMessage}</p>}
      </div>

      {results.length > 0 && (
        <div className="col-start-2 row-start-2 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/20 max-[860px]:shrink-0 max-[860px]:overflow-visible">
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
        </div>
      )}

      <aside className="col-start-1 row-start-1 row-span-2 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/20 max-[860px]:shrink-0 max-[860px]:overflow-visible">
        <div className="min-h-full rounded border border-[rgba(255,244,229,.12)] bg-[rgba(8,12,10,.38)] pb-[5px] max-[860px]:hidden">
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t bg-[rgba(8,12,10,.92)] px-[11px] py-[9px]">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[.14em] text-orange">Classical playlist</span>
          </div>
          {mujra.length > 0 ? renderRows(mujra, mujraVisible) : <p className="m-0 px-[11px] py-[13px] font-mono text-[10px] text-white/55">Classical picks are unavailable.</p>}
          {mujraVisible < mujra.length && <div ref={mujraSentinelRef} aria-hidden="true" />}
        </div>
        <PlaylistAccordion
          title="Classical playlist"
          subtitle={`Top ${mujra.length} classicals`}
          list={mujra}
          emptyMessage="Classical picks are unavailable."
          isOpen={expandedPlaylist === "mujra"}
          onToggle={() => setExpandedPlaylist((current) => (current === "mujra" ? null : "mujra"))}
          className="hidden max-[860px]:block"
        />
      </aside>

      <aside className="col-start-3 row-start-1 row-span-2 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/20 max-[860px]:shrink-0 max-[860px]:overflow-visible">
        <div className="min-h-full rounded border border-[rgba(255,244,229,.12)] bg-[rgba(8,12,10,.38)] pb-[5px] max-[860px]:hidden">
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t bg-[rgba(8,12,10,.92)] px-[11px] py-[9px]">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[.14em] text-orange">90s picks</span>
          </div>
          {nineties.length > 0 ? renderRows(nineties, ninetiesVisible) : <p className="m-0 px-[11px] py-[13px] font-mono text-[10px] text-white/55">RKBKK picks are unavailable.</p>}
          {ninetiesVisible < nineties.length && <div ref={ninetiesSentinelRef} aria-hidden="true" />}
        </div>
        <PlaylistAccordion
          title="90s picks"
          subtitle="Best of 90's Bollywood"
          list={nineties}
          emptyMessage="RKBKK picks are unavailable."
          isOpen={expandedPlaylist === "nineties"}
          onToggle={() => setExpandedPlaylist((current) => (current === "nineties" ? null : "nineties"))}
          className="hidden max-[860px]:block"
        />
      </aside>
    </section>
  );
}

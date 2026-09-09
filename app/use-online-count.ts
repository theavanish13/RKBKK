"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PRESENCE_CHANNEL = "room-205-listeners";

// Counts how many browsers currently have the app open, via Supabase Realtime Presence.
// Presence lives entirely in Supabase's realtime server — no table, no API route — and a
// tab drops out the moment its socket closes, so the count needs no heartbeat or TTL.
//
// Returns null until the first sync lands, and stays null when Supabase isn't configured,
// so the caller can fall back to static text rather than render a wrong count.
export function useOnlineCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      // A key per tab rather than per person, so two tabs count as two. `enabled` opts this
      // client into receiving others' presence — without it presenceState() stays empty.
      config: { presence: { key: crypto.randomUUID(), enabled: true } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return count;
}

"use client";

import { useEffect, useState } from "react";

/** Counts down to `target` using the server clock (offset corrects a wrong device clock). */
export function Countdown({ target, offsetMs, onDone }: { target: string; offsetMs: number; onDone?: () => void }) {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offsetMs), 1000);
    return () => clearInterval(t);
  }, [offsetMs]);

  const left = Math.max(0, Date.parse(target) - now);
  useEffect(() => {
    if (left === 0) onDone?.();
  }, [left, onDone]);

  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="font-mono tabular-nums" aria-label={`${h} hours ${m} minutes until the next puzzle`}>
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

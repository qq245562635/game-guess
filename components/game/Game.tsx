"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SITE_NAME, buildShareText } from "@/lib/share";
import type { CandidateEntry, GameState } from "@/lib/types";
import type { GuessResponse, TodayResponse } from "@/server/game/judge";
import { Dialog } from "@/components/ui/Dialog";
import { Countdown } from "./Countdown";
import { GuessTable, describeRow } from "./GuessTable";
import { SearchBox } from "./SearchBox";

type TodayPayload = TodayResponse & { serverNow: string; nextSwitchAt: string };

interface Pending {
  puzzleNumber: number;
  gameId: string;
  title: string;
  clientGuessId: string;
}

const PENDING_KEY = "gg_pending";

function loadPending(): Pending | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

function savePending(p: Pending | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable: retry still works within this page */
  }
}

function newId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function Game() {
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [loadError, setLoadError] = useState<null | { detail?: string; hint?: string }>(null);
  const [candidates, setCandidates] = useState<CandidateEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [announce, setAnnounce] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const retried = useRef(false);

  const state: GameState | undefined = today?.state;
  const over = !!state && state.outcome !== "IN_PROGRESS";

  const loadToday = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/puzzle/today", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string; hint?: string };
        setLoadError({ detail: body.detail ?? `HTTP ${res.status}`, hint: body.hint });
        return null;
      }
      const data = (await res.json()) as TodayPayload;
      setOffsetMs(Date.parse(data.serverNow) - Date.now());
      setToday(data);
      setRevealed([]);
      return data;
    } catch {
      setLoadError({ hint: "Couldn't reach the server. Is `npm run dev` still running?" });
      return null;
    }
  }, []);

  useEffect(() => {
    loadToday();
    fetch("/api/games/index")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: CandidateEntry[]) => setCandidates(d))
      .catch(() => setCandidates([]));
  }, [loadToday]);

  const send = useCallback(
    async (p: Pending) => {
      setBusy(true);
      setNotice("");
      setPending(p);
      savePending(p);
      try {
        const res = await fetch("/api/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ puzzleNumber: p.puzzleNumber, gameId: p.gameId, clientGuessId: p.clientGuessId }),
        });
        if (res.status === 429) {
          setNotice("You're guessing too fast — wait a moment and retry.");
          return;
        }
        if (res.status >= 500) throw new Error(String(res.status));
        // Any definitive answer from the server means this submission is settled.
        setPending(null);
        savePending(null);
        if (res.status === 409 || res.status === 404) {
          setNotice("A new puzzle is available — loading it now.");
          await loadToday();
          return;
        }
        const body = (await res.json()) as GuessResponse;
        if (body.state) {
          const prevOutcome = state?.outcome;
          setToday((t) => (t ? { ...t, state: body.state } : t));
          const rows = body.state.guesses;
          if (body.status === "accepted" && rows.length) setAnnounce(describeRow(rows[rows.length - 1], rows.length));
          if (body.state.outcome !== "IN_PROGRESS" && prevOutcome === "IN_PROGRESS") setResultOpen(true);
        }
        if (body.status === "duplicate") setNotice(`You already guessed ${p.title}. No attempt used.`);
        if (body.status === "invalid") setNotice("That game isn't in the list. No attempt used.");
      } catch {
        setNotice("Couldn't reach the server. Your guess wasn't lost — tap Retry.");
      } finally {
        setBusy(false);
      }
    },
    [loadToday, state?.outcome],
  );

  // Resume a submission that may have been interrupted (e.g. tab closed mid-request).
  useEffect(() => {
    if (!today?.state || retried.current) return;
    retried.current = true;
    const p = loadPending();
    if (p && p.puzzleNumber === today.puzzleNumber && today.state.outcome === "IN_PROGRESS") send(p);
    else savePending(null);
  }, [today, send]);

  const exclude = useMemo(() => new Set(state?.guesses.map((g) => g.game.id) ?? []), [state]);

  function onSubmit(entry: CandidateEntry) {
    if (!today?.state) return;
    send({ puzzleNumber: today.puzzleNumber, gameId: entry.id, title: entry.title, clientGuessId: newId() });
  }

  async function share() {
    if (!state || !over) return;
    const text = buildShareText({
      puzzleNumber: state.puzzleNumber,
      outcome: state.outcome as "WON" | "LOST",
      rows: state.guesses,
      url: window.location.origin,
    });
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled share sheet */
    }
  }

  const wrong = state ? state.guesses.filter((g) => !g.correct).length : 0;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{SITE_NAME}</h1>
          <p className="text-sm text-zinc-500">
            {today ? `Daily puzzle #${today.puzzleNumber} · ${today.dateUtc}` : "Daily video game puzzle"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          How to play
        </button>
      </header>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p>Couldn&apos;t load today&apos;s puzzle.</p>
          {loadError.hint && <p className="mt-2 text-sm font-medium">{loadError.hint}</p>}
          {loadError.detail && <p className="mt-1 font-mono text-xs break-all text-zinc-600 dark:text-zinc-400">{loadError.detail}</p>}
          <button type="button" onClick={loadToday} className="mt-2 font-semibold text-blue-600 underline">
            Try again
          </button>
        </div>
      )}

      {today && !today.available && (
        <p className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
          Today&apos;s puzzle isn&apos;t ready yet. Please check back soon.
        </p>
      )}

      {state && (
        <>
          {!over && (
            <section className="sticky top-0 z-10 -mx-4 space-y-2 bg-zinc-50/95 px-4 py-2 backdrop-blur dark:bg-zinc-950/95">
              <SearchBox candidates={candidates} exclude={exclude} disabled={over} busy={busy} onSubmit={onSubmit} />
              <div className="flex items-center justify-between text-sm">
                <span>
                  <strong className="tabular-nums">{state.remaining}</strong> of {state.maxGuesses} guesses left
                </span>
                {state.guesses.length === 0 && (
                  <span className="text-zinc-500">Guess any game to get your first clues.</span>
                )}
              </div>
              {notice && (
                <div role="status" className="flex items-center justify-between gap-3 text-sm text-amber-700 dark:text-amber-400">
                  <span>{notice}</span>
                  {pending && !busy && (
                    <button type="button" onClick={() => send(pending)} className="font-semibold underline">
                      Retry
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {over && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-lg font-bold">
                {state.outcome === "WON" ? `Solved in ${state.guesses.length}/${state.maxGuesses}!` : "Out of guesses."}
              </p>
              <p className="mt-1">
                The answer was{" "}
                <strong>
                  {state.answer?.title} ({state.answer?.year})
                </strong>
                .
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={share}
                  className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  {copied ? "Copied!" : "Share result"}
                </button>
                <span className="text-sm text-zinc-500">
                  Next puzzle in{" "}
                  {today && <Countdown target={today.nextSwitchAt} offsetMs={offsetMs} onDone={loadToday} />}
                </span>
              </div>
            </section>
          )}

          <GuessTable rows={state.guesses} />

          <section aria-labelledby="hints-title" className="space-y-2">
            <h2 id="hints-title" className="text-sm font-semibold text-zinc-500 uppercase">
              Hints
            </h2>
            {[0, 1].map((i) => {
              const text = state.hints[i];
              const need = i === 0 ? 2 : 4;
              if (!text) {
                return (
                  <p key={i} className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700">
                    Hint {i + 1} unlocks after {need} wrong guesses ({Math.min(wrong, need)}/{need}).
                  </p>
                );
              }
              return revealed.includes(i) || over ? (
                <p key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950">
                  <strong>Hint {i + 1}:</strong> {text}
                </p>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRevealed((r) => [...r, i])}
                  className="block w-full rounded-lg border border-amber-400 px-3 py-2 text-left text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-950"
                >
                  Reveal hint {i + 1}
                </button>
              );
            })}
          </section>
        </>
      )}

      <Dialog
        open={resultOpen && over}
        onClose={() => setResultOpen(false)}
        title={state?.outcome === "WON" ? "You got it!" : "Better luck tomorrow"}
      >
        {state && over && (
          <div className="space-y-3">
            <p>
              The answer was{" "}
              <strong>
                {state.answer?.title} ({state.answer?.year})
              </strong>
              .
            </p>
            <p className="text-sm text-zinc-500">
              {state.outcome === "WON" ? `Solved in ${state.guesses.length}/${state.maxGuesses}.` : "X/6"}
            </p>
            <button
              type="button"
              onClick={share}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
            >
              {copied ? "Copied to clipboard!" : "Share result"}
            </button>
            {today && (
              <p className="text-center text-sm text-zinc-500">
                Next puzzle in <Countdown target={today.nextSwitchAt} offsetMs={offsetMs} />
              </p>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="How to play">
        <div className="space-y-3 text-sm leading-relaxed">
          <p>Guess today&apos;s video game in {6} tries. Everyone gets the same game; it changes at 00:00 UTC.</p>
          <p>Each guess shows how it compares to the answer:</p>
          <ul className="space-y-1.5">
            <li>
              <span className="rounded bg-hit px-1.5 text-white">✓ Match</span> — identical
            </li>
            <li>
              <span className="rounded bg-near px-1.5 text-black">~ Partial</span> — some genres, platforms or
              perspectives overlap
            </li>
            <li>
              <span className="rounded bg-zinc-200 px-1.5 dark:bg-zinc-800">✗ No</span> — nothing in common
            </li>
            <li>
              <strong>↑ Later / ↓ Earlier</strong> — the answer was released later or earlier than your guess
            </li>
          </ul>
          <p>Platforms are the ones available at launch. Hints unlock after 2 and 4 wrong guesses.</p>
          <p>Repeat or unknown guesses never use up an attempt.</p>
        </div>
      </Dialog>
    </div>
  );
}

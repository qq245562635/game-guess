"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SITE_NAME, buildShareText } from "@/lib/share";
import type { CandidateEntry, GameState } from "@/lib/types";
import type { GuessResponse, TodayResponse } from "@/server/game/judge";
import { Dialog } from "@/components/ui/Dialog";
import { Countdown } from "./Countdown";
import { GuessTable, describeRow } from "./GuessTable";
import { Lives } from "./Lives";
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
  const dateLabel = today
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(
        new Date(`${today.dateUtc}T00:00:00Z`),
      )
    : null;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 pt-2">
        <div>
          <h1 className="font-display text-[clamp(2rem,6vw,3.25rem)] leading-none tracking-tight">{SITE_NAME}</h1>
          <p className="mt-2 flex items-center gap-2 text-ink-soft">
            <span
              aria-hidden="true"
              className={`inline-block size-2.5 rounded-full ${today?.available ? "bg-led" : "bg-miss"}`}
            />
            {today ? (
              <span>
                Puzzle <strong className="text-ink">#{today.puzzleNumber}</strong>, {dateLabel}
              </span>
            ) : (
              <span>One video game a day. Six guesses.</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="shrink-0 rounded-full border-2 border-ink px-4 py-2 text-sm font-bold hover:bg-ink hover:text-shell"
        >
          How to play
        </button>
      </header>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {loadError && (
        <div role="alert" className="rounded-2xl border-2 border-abtn bg-screen p-4">
          <p className="font-bold">Today&apos;s puzzle didn&apos;t load.</p>
          {loadError.hint && <p className="mt-2 text-sm">{loadError.hint}</p>}
          {loadError.detail && <p className="mt-1 text-xs break-all text-ink-soft">{loadError.detail}</p>}
          <button type="button" onClick={loadToday} className="mt-3 font-bold text-abtn underline">
            Try again
          </button>
        </div>
      )}

      {today && !today.available && (
        <p className="rounded-2xl border-2 border-dashed border-miss p-4">
          Today&apos;s puzzle isn&apos;t published yet. Check back after the next update.
        </p>
      )}

      {state && (
        <div className="rounded-[28px] border-2 border-shell-edge bg-screen p-3 sm:p-5">
          {!over && (
            <section className="sticky top-0 z-10 -mx-3 -mt-3 space-y-3 rounded-t-[26px] bg-screen/95 px-3 pt-3 pb-3 backdrop-blur sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5">
              <SearchBox candidates={candidates} exclude={exclude} disabled={over} busy={busy} onSubmit={onSubmit} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Lives remaining={state.remaining} max={state.maxGuesses} />
                {state.guesses.length === 0 && (
                  <span className="text-sm text-ink-soft">Any game works as a first guess.</span>
                )}
              </div>
              {notice && (
                <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-shell px-3 py-2 text-sm">
                  <span>{notice}</span>
                  {pending && !busy && (
                    <button type="button" onClick={() => send(pending)} className="font-bold text-abtn underline">
                      Retry
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {over && (
            <section className="mb-4 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-shell p-4 sm:p-5">
              <div>
                <p className="text-sm text-ink-soft">
                  {state.outcome === "WON"
                    ? `Solved in ${state.guesses.length} of ${state.maxGuesses}`
                    : "Out of guesses. Today's game was"}
                </p>
                <p className="mt-1 text-2xl leading-tight font-bold">
                  {state.answer?.title} <span className="font-normal text-ink-soft">({state.answer?.year})</span>
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  Next puzzle in{" "}
                  {today && <Countdown target={today.nextSwitchAt} offsetMs={offsetMs} onDone={loadToday} />}
                </p>
              </div>
              <button
                type="button"
                onClick={share}
                className="rounded-full bg-abtn px-6 py-3 font-bold text-white shadow-[0_4px_0_var(--abtn-press)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--abtn-press)]"
              >
                {copied ? "Copied" : "Share result"}
              </button>
            </section>
          )}

          <GuessTable rows={state.guesses} maxGuesses={state.maxGuesses} over={over} />

          <section aria-labelledby="hints-title" className="mt-4 grid gap-2 sm:grid-cols-2">
            <h2 id="hints-title" className="sr-only">
              Hints
            </h2>
            {[0, 1].map((i) => {
              const text = state.hints[i];
              const need = i === 0 ? 2 : 4;
              if (!text) {
                return (
                  <div key={i} className="rounded-2xl border-2 border-dashed border-shell-edge px-4 py-3 text-sm text-ink-soft">
                    <span aria-hidden="true">🔒 </span>
                    Hint {i + 1} unlocks after {need} misses
                    <span className="ml-2 tabular-nums">
                      ({Math.min(wrong, need)}/{need})
                    </span>
                  </div>
                );
              }
              return revealed.includes(i) || over ? (
                <p key={i} className="rounded-2xl bg-shell px-4 py-3 text-sm">
                  <strong>Hint {i + 1}.</strong> {text}
                </p>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRevealed((r) => [...r, i])}
                  className="rounded-2xl border-2 border-amber px-4 py-3 text-left text-sm font-bold hover:bg-shell"
                >
                  Reveal hint {i + 1}
                </button>
              );
            })}
          </section>
        </div>
      )}

      <Dialog
        open={resultOpen && over}
        onClose={() => setResultOpen(false)}
        title={state?.outcome === "WON" ? "Solved!" : "Out of guesses"}
      >
        {state && over && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-ink-soft">Today&apos;s game</p>
              <p className="text-2xl leading-tight font-bold">
                {state.answer?.title} <span className="font-normal text-ink-soft">({state.answer?.year})</span>
              </p>
            </div>
            <p className="font-display text-4xl leading-none">
              {state.outcome === "WON" ? `${state.guesses.length}/${state.maxGuesses}` : `X/${state.maxGuesses}`}
            </p>
            <button
              type="button"
              onClick={share}
              className="w-full rounded-full bg-abtn px-6 py-3 font-bold text-white shadow-[0_4px_0_var(--abtn-press)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--abtn-press)]"
            >
              {copied ? "Copied to clipboard" : "Share result"}
            </button>
            {today && (
              <p className="text-center text-sm text-ink-soft">
                Next puzzle in <Countdown target={today.nextSwitchAt} offsetMs={offsetMs} />
              </p>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="How to play">
        <div className="space-y-4 text-sm leading-relaxed">
          <p>
            Guess today&apos;s video game in six tries. Everyone gets the same game, and it changes at midnight UTC.
          </p>
          <p>Each guess is compared with the answer, one attribute at a time:</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-3">
              <span className="w-24 shrink-0 rounded-lg bg-led px-2 py-1 text-center text-xs font-bold text-white">✓ Match</span>
              Same as the answer
            </li>
            <li className="flex items-center gap-3">
              <span className="cell-partial w-24 shrink-0 rounded-lg px-2 py-1 text-center text-xs font-bold">≈ Partial</span>
              Some genres, platforms or perspectives overlap
            </li>
            <li className="flex items-center gap-3">
              <span className="w-24 shrink-0 rounded-lg border-2 border-miss px-2 py-0.5 text-center text-xs font-bold text-ink-soft">
                ✕ No match
              </span>
              Nothing in common
            </li>
            <li className="flex items-center gap-3">
              <span className="w-24 shrink-0 rounded-lg border-2 border-miss px-2 py-0.5 text-center text-xs font-bold text-ink-soft">
                ↑ Later
              </span>
              The answer came out later than your guess (↓ Earlier: before it)
            </li>
          </ul>
          <p>Platforms are the ones the game launched on. Hints unlock after 2 and 4 misses.</p>
          <p>Repeated or unknown games never cost a guess.</p>
        </div>
      </Dialog>
    </div>
  );
}

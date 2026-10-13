"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildSearchIndex, searchCandidates } from "@/lib/normalize";
import type { CandidateEntry } from "@/lib/types";

interface Props {
  candidates: CandidateEntry[] | null;
  exclude: ReadonlySet<string>;
  disabled: boolean;
  busy: boolean;
  onSubmit: (entry: CandidateEntry) => void;
}

export function SearchBox({ candidates, exclude, disabled, busy, onSubmit }: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<CandidateEntry | null>(null);
  // Closing on blur is delayed so a click on an option still lands; cancel it if focus returns.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => cancelClose, []);

  const index = useMemo(() => (candidates ? buildSearchIndex(candidates) : []), [candidates]);
  const results = useMemo(() => searchCandidates(index, query, 8, exclude), [index, query, exclude]);
  const showList = open && results.length > 0 && !selected;
  // Distinguish "already guessed" from "not in the list" when nothing is offered.
  const alreadyGuessed = useMemo(
    () => results.length === 0 && searchCandidates(index, query, 1).length > 0,
    [index, query, results.length],
  );

  function choose(entry: CandidateEntry) {
    setSelected(entry);
    setQuery(entry.title);
    setOpen(false);
  }

  function submit() {
    if (!selected || busy || disabled) return;
    onSubmit(selected);
    setSelected(null);
    setQuery("");
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selected) submit();
      else if (showList) choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const loading = candidates === null;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search for a game
        </label>
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          disabled={disabled || loading}
          placeholder={loading ? "Loading the game list…" : "Name a game, e.g. Hollow Knight"}
          value={query}
          onChange={(e) => {
            cancelClose();
            setQuery(e.target.value);
            setSelected(null);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => {
            cancelClose();
            setOpen(true);
          }}
          onBlur={() => {
            cancelClose();
            closeTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 rounded-2xl border-2 border-ink bg-shell px-4 py-3 text-base font-bold placeholder:font-normal placeholder:text-ink-soft disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!selected || busy || disabled}
          className="shrink-0 rounded-full bg-abtn px-6 py-3 font-bold text-white shadow-[0_4px_0_var(--abtn-press)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--abtn-press)] disabled:cursor-not-allowed disabled:bg-miss disabled:shadow-none"
        >
          {busy ? "…" : "Guess"}
        </button>
      </div>

      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border-2 border-ink bg-screen py-1 shadow-[0_8px_0_var(--shell-edge)]"
        >
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer justify-between gap-3 px-4 py-2.5 ${
                i === active ? "bg-shell" : ""
              }`}
            >
              <span>{r.title}</span>
              <span className="text-ink-soft tabular-nums">{r.year}</span>
            </li>
          ))}
        </ul>
      )}
      {open && !selected && query.trim() && !loading && results.length === 0 && (
        <p className="mt-2 text-sm text-ink-soft" role="status">
          {alreadyGuessed ? "You've already guessed every game that matches." : 'No game by that name. Try fewer words or a common short name like "GTA V".'}
        </p>
      )}
    </div>
  );
}

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
          placeholder={loading ? "Loading games…" : "Type a game title…"}
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
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base shadow-sm placeholder:text-zinc-400 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!selected || busy || disabled}
          className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-700"
        >
          {busy ? "…" : "Guess"}
        </button>
      </div>

      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
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
              className={`flex cursor-pointer justify-between gap-3 px-4 py-2 ${
                i === active ? "bg-blue-50 dark:bg-blue-950" : ""
              }`}
            >
              <span>{r.title}</span>
              <span className="text-zinc-500 tabular-nums">{r.year}</span>
            </li>
          ))}
        </ul>
      )}
      {open && !selected && query.trim() && !loading && results.length === 0 && (
        <p className="mt-2 text-sm text-zinc-500" role="status">
          No matching game. Try a shorter title or a common abbreviation.
        </p>
      )}
    </div>
  );
}

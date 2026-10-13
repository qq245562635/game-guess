import { softHyphenate } from "@/lib/hyphenate";
import type { Cell, GuessRow } from "@/lib/types";

const COLUMNS = ["Year", "Genre", "Platform", "Developer", "Publisher", "Perspective"];

const LOOK = {
  exact: "bg-led text-white",
  partial: "cell-partial",
  none: "border-2 border-miss text-ink-soft",
} as const;

const MARK = { exact: "Match", partial: "Partial", none: "No match" } as const;
const ICON = { exact: "✓", partial: "≈", none: "✕" } as const;

function CellView({ cell }: { cell: Cell }) {
  if (cell.dim === "year") {
    const look = cell.result === "exact" ? LOOK.exact : LOOK.none;
    const label = cell.result === "exact" ? "Match" : cell.result === "answer_earlier" ? "Earlier" : "Later";
    const arrow = cell.result === "exact" ? "✓" : cell.result === "answer_earlier" ? "↓" : "↑";
    return (
      <td className={`rounded-xl px-2 py-2 text-center ${look}`}>
        <div className="font-display text-xl leading-none tabular-nums">{cell.value}</div>
        <div className="mt-1 text-xs font-bold">
          <span aria-hidden="true">{arrow} </span>
          {label}
        </div>
      </td>
    );
  }
  const text = softHyphenate("values" in cell ? cell.values.join(", ") : cell.value);
  return (
    <td className={`rounded-xl px-2 py-2 text-center ${LOOK[cell.result]}`}>
      <div
        lang="en"
        className={`leading-tight font-bold [overflow-wrap:break-word] hyphens-manual ${
          /\S{11,}/.test(text) ? "text-xs" : "text-[13px]"
        }`}
      >
        {text}
      </div>
      <div className="mt-1 text-xs">
        <span aria-hidden="true">{ICON[cell.result]} </span>
        {MARK[cell.result]}
      </div>
    </td>
  );
}

function EmptySlot({ n, next }: { n: number; next: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-[58px] items-center rounded-xl border-2 border-dashed px-4 text-sm ${
        next ? "border-ink-soft text-ink-soft" : "border-shell-edge"
      }`}
    >
      {next ? `Guess ${n} goes here` : null}
    </div>
  );
}

export function GuessTable({ rows, maxGuesses, over }: { rows: GuessRow[]; maxGuesses: number; over: boolean }) {
  const empty = over ? 0 : maxGuesses - rows.length;
  return (
    <>
      <div className="-mx-3 overflow-x-auto px-3 pb-1 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[700px] table-fixed border-separate border-spacing-x-1.5 border-spacing-y-1.5">
        <caption className="sr-only">Your guesses and how each attribute compares to the answer</caption>
        <colgroup>
          <col className="w-[22%]" />
          {COLUMNS.map((c) => (
            <col key={c} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-ink-soft">
            <th scope="col" className="sticky left-0 z-[1] bg-screen px-3 pb-1 font-bold shadow-[-18px_0_0_var(--screen),8px_0_0_var(--screen)]">
              Game
            </th>
            {COLUMNS.map((h) => (
              <th key={h} scope="col" className="px-2 pb-1 text-center font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.game.id} data-guess className={i === rows.length - 1 ? "slot-in" : undefined}>
              <th
                scope="row"
                // Opaque, square sticky cell (with edge masks) so scrolled cells never show around it.
                className="sticky left-0 z-[1] h-px bg-screen p-0 text-left align-middle shadow-[-18px_0_0_var(--screen),8px_0_0_var(--screen)]"
              >
                <div
                  className={`flex h-full flex-col justify-center rounded-xl px-3 py-2 ${
                    r.correct ? "bg-led text-white" : "text-ink"
                  }`}
                >
                  <div className="text-sm leading-tight font-bold">{r.game.title}</div>
                  <div className={`mt-0.5 text-xs ${r.correct ? "text-white/85" : "text-ink-soft"}`}>Guess {i + 1}</div>
                </div>
              </th>
              {r.cells.map((c) => (
                <CellView key={c.dim} cell={c} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {empty > 0 && (
        <div className="mt-1.5 space-y-1.5 px-1.5">
          {Array.from({ length: empty }, (_, k) => (
            <EmptySlot key={k} n={rows.length + k + 1} next={k === 0} />
          ))}
        </div>
      )}
    </>
  );
}

/** One-sentence summary for screen readers after each guess. */
export function describeRow(row: GuessRow, attempt: number): string {
  if (row.correct) return `Guess ${attempt}: ${row.game.title} is correct!`;
  const parts = row.cells.map((c) => {
    if (c.dim === "year") {
      return c.result === "exact" ? "year matches" : c.result === "answer_earlier" ? "answer is earlier" : "answer is later";
    }
    return `${c.dim} ${c.result === "exact" ? "match" : c.result === "partial" ? "partial" : "no match"}`;
  });
  return `Guess ${attempt}: ${row.game.title}. ${parts.join(", ")}.`;
}

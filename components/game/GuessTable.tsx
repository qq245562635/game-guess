import type { Cell, GuessRow } from "@/lib/types";

const HEADERS = ["Year", "Genre", "Platform", "Developer", "Publisher", "Perspective"];

const STYLE = {
  exact: "bg-hit text-white",
  partial: "bg-near text-black",
  none: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
} as const;

const MARK = { exact: "✓ Match", partial: "~ Partial", none: "✗ No" } as const;

function CellView({ cell }: { cell: Cell }) {
  if (cell.dim === "year") {
    const style = cell.result === "exact" ? STYLE.exact : STYLE.none;
    const label =
      cell.result === "exact" ? "✓ Match" : cell.result === "answer_earlier" ? "↓ Earlier" : "↑ Later";
    return (
      <td className={`rounded-lg px-2 py-2 text-center align-middle ${style}`}>
        <div className="text-base font-bold tabular-nums">{cell.value}</div>
        <div className="text-xs font-medium">{label}</div>
      </td>
    );
  }
  const text = "values" in cell ? cell.values.join(", ") : cell.value;
  return (
    <td className={`rounded-lg px-2 py-2 text-center align-middle ${STYLE[cell.result]}`}>
      <div className="text-sm leading-tight font-medium">{text}</div>
      <div className="mt-0.5 text-xs opacity-90">{MARK[cell.result]}</div>
    </td>
  );
}

export function GuessTable({ rows }: { rows: GuessRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Your guesses and how each attribute compares to the answer</caption>
        <thead>
          <tr className="text-xs text-zinc-500 uppercase">
            <th scope="col" className="px-2 py-1 text-left font-semibold">
              Game
            </th>
            {HEADERS.map((h) => (
              <th key={h} scope="col" className="px-2 py-1 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.game.id} className={i === rows.length - 1 ? "row-in" : undefined}>
              <th
                scope="row"
                className={`rounded-lg px-3 py-2 text-left font-semibold ${
                  r.correct ? STYLE.exact : "bg-white dark:bg-zinc-900"
                }`}
              >
                {r.game.title}
              </th>
              {r.cells.map((c) => (
                <CellView key={c.dim} cell={c} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

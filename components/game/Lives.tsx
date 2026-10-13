/** Remaining guesses as cartridges: full ones are lives left, hollow ones are spent. */
export function Lives({ remaining, max }: { remaining: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => {
          const full = i < remaining;
          return (
            <svg key={i} width="18" height="22" viewBox="0 0 18 22" className={full ? "text-abtn" : "text-miss"}>
              <path
                d="M2 1h14v16l-2 2v2H4v-2l-2-2z"
                fill={full ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {full && <rect x="5" y="4" width="8" height="6" rx="1" fill="var(--screen)" />}
            </svg>
          );
        })}
      </div>
      <span className="text-sm">
        <strong className="font-display text-base tabular-nums">{remaining}</strong>{" "}
        {remaining === 1 ? "guess" : "guesses"} left
      </span>
    </div>
  );
}

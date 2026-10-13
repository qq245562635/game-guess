"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Native <dialog>: focus trapping, Escape and backdrop come from the browser. */
export function Dialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(92vw,460px)] rounded-[28px] border-2 border-ink bg-screen p-0 text-ink shadow-[0_10px_0_var(--shell-edge)] backdrop:bg-[#211d33]/60"
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="dialog-title" className="font-display text-2xl leading-none">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2.5 py-1 text-ink-soft hover:bg-shell"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

"use client";
import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {}
      }}
      className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-2"
      title={text}
    >
      {done ? "Copied to clipboard" : label}
    </button>
  );
}

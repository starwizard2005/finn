"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Brief", match: (p: string) => p === "/" || p.startsWith("/event") },
  { href: "/ask", label: "Ask", match: (p: string) => p.startsWith("/ask") || p.startsWith("/company") },
  { href: "/network", label: "Network", match: (p: string) => p.startsWith("/network") || p.startsWith("/person") },
];

function Icon({ name, on }: { name: string; on: boolean }) {
  const s = on ? 2.2 : 1.7;
  if (name === "Brief")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" aria-hidden>
        <path d="M5 6h14M5 12h9M5 18h5" />
        <circle cx="18.5" cy="17.5" r="2.5" fill={on ? "var(--color-signal)" : "none"} stroke={on ? "var(--color-signal)" : "currentColor"} />
      </svg>
    );
  if (name === "Ask")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" aria-hidden>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5 5" />
      </svg>
    );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" aria-hidden>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8.2 8.2l2.6 7.6M15.8 7.4l-2.6 8.4M8.5 6.8h7" />
    </svg>
  );
}

export function BottomNav() {
  const p = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto flex max-w-[460px] border-t border-line bg-sheet/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {TABS.map((t) => {
          const on = t.match(p);
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[12px] ${on ? "text-ink font-semibold" : "text-ink-3"}`}>
              <Icon name={t.label} on={on} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

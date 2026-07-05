"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TickerItem = {
  text: string;
  href?: string;
};

type TickerProps = {
  items: TickerItem[];
};

/**
 * "Just Happened" rotating line.
 * Ambient text — cycles through recent events every 4s.
 */
export const Ticker = ({ items }: TickerProps) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % items.length), 4000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[idx % items.length];

  return (
    <div
      className="w-full py-2 px-4 font-numeric text-xs uppercase tracking-widest text-ink-soft overflow-hidden"
      style={{ borderBottom: "1px solid rgb(44 26 14 / 0.1)" }}
    >
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <span className="text-blood font-bold shrink-0">◉ Just Happened</span>
        <span className="opacity-40">·</span>
        {current.href ? (
          <Link href={current.href} className="link truncate">
            {current.text}
          </Link>
        ) : (
          <span className="truncate">{current.text}</span>
        )}
      </div>
    </div>
  );
};

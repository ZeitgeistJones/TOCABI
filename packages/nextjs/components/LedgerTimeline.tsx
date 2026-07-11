"use client";

import { useState } from "react";
import { formatUnits } from "viem";

export type LedgerEntryType =
  | "created"
  | "pledge"
  | "claim"
  | "proof"
  | "approved"
  | "rejected"
  | "vote"
  | "veto"
  | "judge"
  | "refund"
  | "paid"
  | "expired"
  | "cancelled";

export type LedgerEntry = {
  type: LedgerEntryType;
  label: string;
  address?: string;
  amount?: bigint;
  timestamp?: number;
  /** Used for ordering when block timestamps aren't available on the log */
  blockNumber?: bigint;
};

type LedgerTimelineProps = {
  entries: LedgerEntry[];
  /** Rows shown before "Show full ledger" collapse kicks in */
  collapseAfter?: number;
};

function relativeTime(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const TYPE_ICON: Record<LedgerEntryType, string> = {
  created: "📋",
  pledge: "💰",
  claim: "✋",
  proof: "📦",
  approved: "👍",
  rejected: "👎",
  vote: "🗳️",
  veto: "🚫",
  judge: "⚖️",
  refund: "↩️",
  paid: "✅",
  expired: "⌛",
  cancelled: "✖️",
};

/**
 * Ledger timeline — the chronological record of on-chain activity on a bounty.
 * Newest first. Collapses after `collapseAfter` rows (spec: 5) with a
 * "Show full ledger" expander.
 */
export const LedgerTimeline = ({ entries, collapseAfter = 5 }: LedgerTimelineProps) => {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return (
      <p className="font-numeric text-xs uppercase tracking-widest text-faded text-center py-4">No activity yet.</p>
    );
  }

  const visible = expanded ? entries : entries.slice(0, collapseAfter);
  const hiddenCount = entries.length - visible.length;

  return (
    <div>
      <ol className="space-y-0">
        {visible.map((entry, i) => (
          <li key={i} className="flex gap-3 group">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <span className="text-base" aria-hidden>
                {TYPE_ICON[entry.type]}
              </span>
              {i < visible.length - 1 && <div className="w-px flex-1 bg-ink/15 mt-1" />}
            </div>

            {/* Content */}
            <div className={`min-w-0 ${i === visible.length - 1 ? "pb-0" : "pb-4"}`}>
              <p className="font-body text-sm text-ink m-0 leading-snug">{entry.label}</p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                {entry.address && (
                  <span className="font-numeric text-xs text-ink-soft">{truncateAddr(entry.address)}</span>
                )}
                {entry.amount !== undefined && entry.amount > 0n && (
                  <span
                    className={`font-numeric text-xs font-bold ${entry.type === "refund" ? "text-ink-soft" : "text-blood"}`}
                  >
                    {entry.type === "refund" ? "−" : "+"}
                    {Number(formatUnits(entry.amount, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    CLAWD
                  </span>
                )}
                {entry.timestamp !== undefined && entry.timestamp > 0 && (
                  <span className="font-numeric text-xs text-faded">{relativeTime(entry.timestamp)}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 font-numeric text-xs uppercase tracking-widest text-ink-soft link cursor-pointer"
        >
          Show full ledger ({hiddenCount} more)
        </button>
      )}
      {expanded && entries.length > collapseAfter && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-3 font-numeric text-xs uppercase tracking-widest text-faded link cursor-pointer"
        >
          Collapse
        </button>
      )}
    </div>
  );
};

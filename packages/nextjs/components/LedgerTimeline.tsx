import { formatUnits } from "viem";

export type LedgerEntry = {
  type: "pledge" | "claim" | "proof" | "paid" | "created";
  label: string;
  address?: string;
  amount?: bigint;
  timestamp?: number;
};

type LedgerTimelineProps = {
  entries: LedgerEntry[];
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

const TYPE_ICON: Record<LedgerEntry["type"], string> = {
  created: "📋",
  pledge: "💰",
  claim: "✋",
  proof: "📦",
  paid: "✅",
};

/**
 * Ledger timeline — the chronological record of on-chain activity on a bounty.
 * Shows pledge amounts, claimants, proof submissions, and payouts.
 */
export const LedgerTimeline = ({ entries }: LedgerTimelineProps) => {
  if (entries.length === 0) {
    return (
      <p className="font-numeric text-xs uppercase tracking-widest text-faded text-center py-4">
        No activity yet.
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, i) => (
        <li key={i} className="flex gap-3 group">
          {/* Timeline spine */}
          <div className="flex flex-col items-center">
            <span className="text-base" aria-hidden>
              {TYPE_ICON[entry.type]}
            </span>
            {i < entries.length - 1 && <div className="w-px flex-1 bg-ink/15 mt-1" />}
          </div>

          {/* Content */}
          <div className={`pb-4 min-w-0 ${i === entries.length - 1 ? "pb-0" : ""}`}>
            <p className="font-body text-sm text-ink m-0 leading-snug">{entry.label}</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {entry.address && (
                <span className="font-numeric text-xs text-ink-soft">{truncateAddr(entry.address)}</span>
              )}
              {entry.amount !== undefined && entry.amount > 0n && (
                <span className="font-numeric text-xs text-blood font-bold">
                  +{Number(formatUnits(entry.amount, 18)).toFixed(2)} CLAWD
                </span>
              )}
              {entry.timestamp && (
                <span className="font-numeric text-xs text-faded">{relativeTime(entry.timestamp)}</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};

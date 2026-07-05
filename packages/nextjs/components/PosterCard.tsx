import Link from "next/link";
import { Countdown } from "~~/components/Countdown";
import { PotAmount } from "~~/components/PotAmount";
import { StatusStamp } from "~~/components/StatusStamp";
import { getStatusEntry } from "~~/utils/statusMap";

type PosterCardProps = {
  id: bigint;
  title: string;
  totalPledged: bigint;
  status: number;
  deadline: bigint;
};

/**
 * Board card — shows exactly 4 things: title, pot, StatusStamp, countdown.
 * Nothing else.
 */
export const PosterCard = ({ id, title, totalPledged, status, deadline }: PosterCardProps) => {
  const { degraded } = getStatusEntry(status);

  return (
    <Link
      href={`/bounty/${id.toString()}`}
      className={`block parchment relative overflow-hidden hover:shadow-md transition-shadow group ${
        degraded ? "poster-expired" : ""
      }`}
    >
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        {/* Title */}
        <h3 className="font-display text-lg sm:text-xl font-bold leading-snug mb-3 text-ink group-hover:text-blood transition-colors line-clamp-2">
          {title || "(no description)"}
        </h3>

        {/* The 4 things */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PotAmount amount={totalPledged} size="md" />

          <div className="flex items-center gap-3">
            <StatusStamp status={status} />
            <span className="font-numeric text-xs">
              <Countdown deadline={deadline} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

/**
 * Skeleton card shown during loading — styled as a blank poster.
 */
export const PosterCardSkeleton = () => (
  <div className="parchment px-5 py-4 sm:px-6 sm:py-5">
    <div className="flex items-center justify-between mb-3">
      <div className="h-3 bg-ink/10 rounded animate-pulse w-24" />
    </div>
    <div className="h-6 bg-ink/10 rounded animate-pulse w-3/4 mb-1" />
    <div className="h-4 bg-ink/10 rounded animate-pulse w-1/2 mb-4" />
    <div className="flex items-end justify-between gap-3">
      <div className="h-7 bg-ink/10 rounded animate-pulse w-32" />
      <div className="flex items-center gap-3">
        <div className="h-5 bg-ink/10 rounded animate-pulse w-16" />
        <div className="h-4 bg-ink/10 rounded animate-pulse w-20" />
      </div>
    </div>
    <p className="font-numeric text-[0.6rem] uppercase tracking-widest text-faded mt-3 text-right">printing…</p>
  </div>
);

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { ClientOnly } from "~~/components/ClientOnly";
import { HeroStats } from "~~/components/StatBlock";
import { Ticker } from "~~/components/Ticker";
import { PosterCard, PosterCardSkeleton } from "~~/components/PosterCard";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

// Base mainnet contract deploy block (approx) — keeps RPC queries cheap
const FROM_BLOCK = 45_670_000n;

type BountyEvent = {
  args: {
    id?: bigint;
    creator?: string;
    descriptionCID?: string;
    deadline?: bigint;
    resolutionMode?: number;
    claimMode?: number;
    refundPolicy?: number;
  };
  blockNumber?: bigint;
};

type BountyRow = {
  id: bigint;
  title: string;
  deadline: bigint;
  resolutionMode: number;
  claimMode: number;
  /** Populated by LiveBountyReader */
  totalPledged: bigint;
  /** Populated by LiveBountyReader */
  status: number;
};

type FilterKey = "pot" | "ending" | "newest" | "open";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "pot", label: "Biggest Pot" },
  { key: "ending", label: "Ending Soon" },
  { key: "newest", label: "Newest" },
  { key: "open", label: "Needs a Builder" },
];

// ---
// Reads a single bounty's live state and calls onUpdate to lift state up.
// ---
const LiveBountyReader = ({
  id,
  onUpdate,
}: {
  id: bigint;
  onUpdate: (id: string, totalPledged: bigint, status: number, deadline: bigint) => void;
}) => {
  const { data } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "bounties",
    args: [id],
  });

  useEffect(() => {
    if (!data) return;
    const tuple = data as readonly unknown[];
    const totalPledged = tuple[5] as bigint;
    const status = Number(tuple[6] as number);
    const deadline = tuple[4] as bigint;
    onUpdate(id.toString(), totalPledged, status, deadline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return null;
};

// ---
// Main board view
// ---
const BoardContent = () => {
  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "MostClawdWanted",
    eventName: "BountyCreated",
    fromBlock: FROM_BLOCK,
    watch: true,
  });

  const { data: bountyCount } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "bountyCount",
  });

  const [filter, setFilter] = useState<FilterKey>("pot");
  const [liveData, setLiveData] = useState<Record<string, { totalPledged: bigint; status: number; deadline: bigint }>>({});

  const baseBounties = useMemo<BountyRow[]>(() => {
    if (!events) return [];
    return (events as unknown as BountyEvent[])
      .filter(e => e?.args?.id !== undefined)
      .map(e => ({
        id: e.args.id as bigint,
        title: e.args.descriptionCID ?? "",
        deadline: e.args.deadline ?? 0n,
        resolutionMode: Number(e.args.resolutionMode ?? 0),
        claimMode: Number(e.args.claimMode ?? 0),
        totalPledged: 0n,
        status: 0,
      }));
  }, [events]);

  const handleUpdate = (id: string, totalPledged: bigint, status: number, deadline: bigint) => {
    setLiveData(prev => {
      const cur = prev[id];
      if (cur && cur.totalPledged === totalPledged && cur.status === status) return prev;
      return { ...prev, [id]: { totalPledged, status, deadline } };
    });
  };

  const merged = useMemo<BountyRow[]>(() => {
    return baseBounties.map(r => {
      const live = liveData[r.id.toString()];
      return live ? { ...r, totalPledged: live.totalPledged, status: live.status, deadline: live.deadline } : r;
    });
  }, [baseBounties, liveData]);

  // Hero stats
  const heroStats = useMemo(() => {
    let totalPooled = 0n;
    let openCount = 0;
    let builtCount = 0;
    for (const r of merged) {
      totalPooled += r.totalPledged;
      if (r.status === 0) openCount++;
      if (r.status === 3) builtCount++;
    }
    return { totalPooled, openCount, builtCount };
  }, [merged]);

  // Ticker items from recent events
  const tickerItems = useMemo(() => {
    const items: { text: string; href?: string }[] = [];
    const recent = [...merged].sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 8);
    for (const r of recent) {
      if (r.status === 3) {
        items.push({ text: `Bounty #${r.id} was built and paid out`, href: `/bounty/${r.id}` });
      } else if (r.status === 1) {
        items.push({ text: `Bounty #${r.id} has been claimed`, href: `/bounty/${r.id}` });
      } else if (r.totalPledged > 0n) {
        items.push({
          text: `Bounty #${r.id}: ${r.title.slice(0, 50)}${r.title.length > 50 ? "…" : ""}`,
          href: `/bounty/${r.id}`,
        });
      }
    }
    return items.slice(0, 6);
  }, [merged]);

  const sorted = useMemo<BountyRow[]>(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const arr = [...merged];
    switch (filter) {
      case "pot":
        return arr.sort((a, b) => (b.totalPledged > a.totalPledged ? 1 : b.totalPledged < a.totalPledged ? -1 : 0));
      case "ending":
        return arr
          .filter(r => r.status === 0 && r.deadline > now)
          .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0));
      case "newest":
        return arr.sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
      case "open":
        return arr
          .filter(r => r.status === 0 && r.totalPledged > 0n)
          .sort((a, b) => (b.totalPledged > a.totalPledged ? 1 : -1));
      default:
        return arr;
    }
  }, [merged, filter]);

  const isEmpty = !isLoading && merged.length === 0 && bountyCount !== undefined && bountyCount === 0n;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Ticker */}
      {tickerItems.length > 0 && <Ticker items={tickerItems} />}

      <div className="w-full max-w-5xl px-4 py-10">
        {/* Page header */}
        <div className="text-center mb-6">
          <h1 className="font-display font-black text-5xl md:text-7xl tracking-tight text-blood mb-1">The Board</h1>
          <p className="font-numeric uppercase tracking-[0.25em] text-ink-soft text-xs">
            community&apos;s most wanted — sorted by reward
          </p>
        </div>

        {/* Hero stats */}
        <HeroStats
          totalPooled={heroStats.totalPooled}
          openCount={heroStats.openCount}
          builtCount={heroStats.builtCount}
        />

        {/* Segmented filter + CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pt-4 border-t border-ink/10">
          <div className="flex flex-wrap gap-1">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`btn btn-xs rounded-none font-numeric uppercase tracking-widest ${
                  filter === tab.key
                    ? "btn-primary"
                    : "btn-ghost text-ink-soft hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Link href="/create" className="btn btn-sm btn-primary rounded-none">
            <span className="font-numeric uppercase tracking-widest">Post a Bounty</span>
          </Link>
        </div>

        {/* Hidden readers — one per bounty */}
        {baseBounties.map(r => (
          <LiveBountyReader key={r.id.toString()} id={r.id} onUpdate={handleUpdate} />
        ))}

        {/* Loading skeletons */}
        {isLoading && merged.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <PosterCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty board */}
        {isEmpty && (
          <div className="parchment p-12 text-center">
            <p className="font-display text-3xl font-black text-blood mb-3">The board&apos;s quiet.</p>
            <p className="font-body text-ink-soft mb-6">Post a bounty and stir things up.</p>
            <Link href="/create" className="btn btn-primary rounded-none">
              <span className="font-numeric uppercase tracking-widest">Post the first one</span>
            </Link>
          </div>
        )}

        {/* No results for this filter */}
        {!isLoading && merged.length > 0 && sorted.length === 0 && (
          <div className="parchment p-8 text-center">
            <p className="font-display text-lg text-ink-soft">No bounties match this filter.</p>
          </div>
        )}

        {/* Board */}
        {sorted.length > 0 && (
          <div className="space-y-3">
            {sorted.map(row => (
              <PosterCard
                key={row.id.toString()}
                id={row.id}
                title={row.title}
                totalPledged={row.totalPledged}
                status={row.status}
                deadline={row.deadline}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Home: NextPage = () => {
  return (
    <ClientOnly
      fallback={
        <div className="flex flex-col items-center w-full">
          <div className="w-full max-w-5xl px-4 py-10">
            <div className="text-center mb-8">
              <h1 className="font-display font-black text-5xl md:text-7xl tracking-tight text-blood mb-1">The Board</h1>
              <p className="font-numeric uppercase tracking-[0.25em] text-ink-soft text-xs">
                community&apos;s most wanted — sorted by reward
              </p>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <PosterCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <BoardContent />
    </ClientOnly>
  );
};

export default Home;

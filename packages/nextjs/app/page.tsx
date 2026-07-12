"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { ClientOnly } from "~~/components/ClientOnly";
import { HeroStats } from "~~/components/StatBlock";
import { Ticker } from "~~/components/Ticker";
import { PosterCard, PosterCardSkeleton } from "~~/components/PosterCard";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

type BountyRow = {
  id: bigint;
  title: string;
  deadline: bigint;
  totalPledged: bigint;
  status: number;
};

type LiveBounty = {
  title: string;
  deadline: bigint;
  totalPledged: bigint;
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
// Reads a single bounty's live state and lifts it to the board.
// Listing uses storage (bountyCount + bounties(id)), not getLogs — event history
// with the default 500-block batch floods Base RPCs and returns an empty board.
// ---
const LiveBountyReader = ({
  id,
  onUpdate,
  onSettled,
}: {
  id: bigint;
  onUpdate: (id: string, live: LiveBounty) => void;
  onSettled: (id: string) => void;
}) => {
  const { data, isFetched, isError } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "bounties",
    args: [id],
    watch: false,
  });

  useEffect(() => {
    if (!isFetched && !isError) return;
    if (data) {
      // bounties() ABI returns a positional tuple (not named fields)
      onUpdate(id.toString(), {
        title: data[2] ?? "",
        deadline: data[4],
        totalPledged: data[5],
        status: Number(data[6]),
      });
    }
    onSettled(id.toString());
  }, [data, isFetched, isError, id, onUpdate, onSettled]);

  return null;
};

// ---
// Main board view
// ---
const BoardContent = () => {
  const { data: bountyCount } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "bountyCount",
  });

  const [filter, setFilter] = useState<FilterKey>("pot");
  const [liveData, setLiveData] = useState<Record<string, LiveBounty>>({});
  const [settled, setSettled] = useState<Record<string, true>>({});

  const bountyIds = useMemo<bigint[]>(() => {
    if (bountyCount === undefined) return [];
    const n = Number(bountyCount);
    if (!Number.isFinite(n) || n <= 0) return [];
    return Array.from({ length: n }, (_, i) => BigInt(i));
  }, [bountyCount]);

  const handleUpdate = useCallback((id: string, live: LiveBounty) => {
    setLiveData(prev => {
      const cur = prev[id];
      if (
        cur &&
        cur.totalPledged === live.totalPledged &&
        cur.status === live.status &&
        cur.deadline === live.deadline &&
        cur.title === live.title
      ) {
        return prev;
      }
      return { ...prev, [id]: live };
    });
  }, []);

  const handleSettled = useCallback((id: string) => {
    setSettled(prev => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const merged = useMemo<BountyRow[]>(() => {
    return bountyIds.flatMap(id => {
      const live = liveData[id.toString()];
      if (!live) return [];
      return [{ id, ...live }];
    });
  }, [bountyIds, liveData]);

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

  // Ticker items from recent bounties
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

  const isLoading =
    bountyCount === undefined ||
    (bountyIds.length > 0 && Object.keys(settled).length < bountyIds.length);
  const isEmpty = bountyCount !== undefined && bountyCount === 0n;

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

        {/* Hidden readers — one per bounty id from on-chain count */}
        {bountyIds.map(id => (
          <LiveBountyReader
            key={id.toString()}
            id={id}
            onUpdate={handleUpdate}
            onSettled={handleSettled}
          />
        ))}

        {/* Loading skeletons */}
        {isLoading && !isEmpty && (
          <div className="space-y-3">
            {Array.from({ length: Math.max(bountyIds.length, 4) || 4 }).map((_, i) => (
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
        {!isLoading && sorted.length > 0 && (
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

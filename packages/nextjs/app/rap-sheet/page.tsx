"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { base } from "viem/chains";
import { useAccount } from "wagmi";
import { ClientOnly } from "~~/components/ClientOnly";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { StatBlock } from "~~/components/StatBlock";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const FROM_BLOCK = 45_670_000n;

type EventLike<T = Record<string, unknown>> = { args: T };

type TabKey = "posted" | "pledged" | "claimed" | "judging" | "won";

const TABS: { key: TabKey; label: string }[] = [
  { key: "posted", label: "Posted" },
  { key: "pledged", label: "Pledged" },
  { key: "claimed", label: "Claimed" },
  { key: "judging", label: "Judging" },
  { key: "won", label: "Won" },
];

const RapSheetContent = () => {
  const { address: connectedAddress } = useAccount();
  const [tab, setTab] = useState<TabKey>("posted");

  const lcAddr = connectedAddress?.toLowerCase();

  const { data: created } = useScaffoldEventHistory({
    contractName: "MostClawdWanted",
    eventName: "BountyCreated",
    fromBlock: FROM_BLOCK,
    watch: false,
  });

  const { data: pledgedEvents } = useScaffoldEventHistory({
    contractName: "MostClawdWanted",
    eventName: "Pledged",
    fromBlock: FROM_BLOCK,
    watch: false,
  });

  const { data: claimedEvents } = useScaffoldEventHistory({
    contractName: "MostClawdWanted",
    eventName: "Claimed",
    fromBlock: FROM_BLOCK,
    watch: false,
  });

  const { data: judgeEvents } = useScaffoldEventHistory({
    contractName: "MostClawdWanted",
    eventName: "JudgeNominated",
    fromBlock: FROM_BLOCK,
    watch: false,
  });

  const { data: finalizedEvents } = useScaffoldEventHistory({
    contractName: "MostClawdWanted",
    eventName: "Finalized",
    fromBlock: FROM_BLOCK,
    watch: false,
  });

  const { stats, bountyIdsByTab } = useMemo(() => {
    if (!lcAddr) {
      return {
        stats: { posted: 0, pledged: 0, claimed: 0, judging: 0, won: 0 },
        bountyIdsByTab: { posted: [], pledged: [], claimed: [], judging: [], won: [] } as Record<TabKey, string[]>,
      };
    }

    const matchAddr = (a?: unknown) => typeof a === "string" && a.toLowerCase() === lcAddr;

    const postedIds: string[] = [];
    for (const e of (created as unknown as EventLike<{ id?: bigint; creator?: string }>[]) ?? []) {
      if (matchAddr(e.args?.creator) && e.args?.id !== undefined) postedIds.push(e.args.id.toString());
    }

    const pledgedIds: string[] = [];
    for (const e of (pledgedEvents as unknown as EventLike<{ bountyId?: bigint; pledger?: string }>[]) ?? []) {
      if (matchAddr(e.args?.pledger) && e.args?.bountyId !== undefined) {
        const id = e.args.bountyId.toString();
        if (!pledgedIds.includes(id)) pledgedIds.push(id);
      }
    }

    const claimedIds: string[] = [];
    for (const e of (claimedEvents as unknown as EventLike<{ bountyId?: bigint; claimant?: string }>[]) ?? []) {
      if (matchAddr(e.args?.claimant) && e.args?.bountyId !== undefined) {
        const id = e.args.bountyId.toString();
        if (!claimedIds.includes(id)) claimedIds.push(id);
      }
    }

    const judgingIds: string[] = [];
    for (const e of (judgeEvents as unknown as EventLike<{ bountyId?: bigint; judge?: string }>[]) ?? []) {
      if (matchAddr(e.args?.judge) && e.args?.bountyId !== undefined) {
        const id = e.args.bountyId.toString();
        if (!judgingIds.includes(id)) judgingIds.push(id);
      }
    }

    const wonIds: string[] = [];
    for (const e of (finalizedEvents as unknown as EventLike<{ bountyId?: bigint; winner?: string }>[]) ?? []) {
      if (matchAddr(e.args?.winner) && e.args?.bountyId !== undefined) {
        const id = e.args.bountyId.toString();
        if (!wonIds.includes(id)) wonIds.push(id);
      }
    }

    return {
      stats: {
        posted: postedIds.length,
        pledged: pledgedIds.length,
        claimed: claimedIds.length,
        judging: judgingIds.length,
        won: wonIds.length,
      },
      bountyIdsByTab: {
        posted: postedIds,
        pledged: pledgedIds,
        claimed: claimedIds,
        judging: judgingIds,
        won: wonIds,
      },
    };
  }, [lcAddr, created, pledgedEvents, claimedEvents, judgeEvents, finalizedEvents]);

  const activeIds = bountyIdsByTab[tab];

  const isClean =
    stats.posted === 0 && stats.pledged === 0 && stats.claimed === 0 && stats.judging === 0 && stats.won === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-display font-black text-5xl md:text-6xl tracking-tight text-blood mb-1">Rap Sheet</h1>
        <p className="font-numeric uppercase tracking-[0.25em] text-ink-soft text-xs">
          everything the chain remembers about you.
        </p>
      </div>

      {!connectedAddress ? (
        <div className="parchment p-10 text-center space-y-4">
          <p className="font-display text-2xl font-bold text-ink">No wallet, no record.</p>
          <p className="font-body text-sm text-ink-soft">Connect your wallet to see your on-chain history.</p>
          <RainbowKitCustomConnectButton />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Identity card */}
          <div className="parchment px-6 py-5">
            <div className="mb-4">
              <p className="font-numeric text-xs uppercase tracking-widest text-faded mb-1">Address</p>
              <Address address={connectedAddress} chain={base} size="sm" />
            </div>

            {/* Stats strip */}
            <div className="flex items-center justify-around pt-3 border-t border-ink/10 flex-wrap gap-4">
              <StatBlock label="Posted" value={stats.posted} />
              <div className="w-px h-8 bg-ink/10" />
              <StatBlock label="Pledged" value={stats.pledged} />
              <div className="w-px h-8 bg-ink/10" />
              <StatBlock label="Claimed" value={stats.claimed} />
              <div className="w-px h-8 bg-ink/10" />
              <StatBlock label="Judging" value={stats.judging} />
              <div className="w-px h-8 bg-ink/10" />
              <StatBlock label="Won" value={stats.won} highlight />
            </div>
          </div>

          {/* Tabs */}
          {!isClean && (
            <div className="parchment px-6 py-5">
              <div className="flex flex-wrap gap-1 mb-5">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`btn btn-xs rounded-none font-numeric uppercase tracking-widest ${
                      tab === t.key ? "btn-primary" : "btn-ghost text-ink-soft"
                    }`}
                  >
                    {t.label}
                    {stats[t.key] > 0 && (
                      <span className="ml-1 text-[0.6rem] opacity-70">({stats[t.key]})</span>
                    )}
                  </button>
                ))}
              </div>

              {activeIds.length === 0 ? (
                <p className="font-numeric text-xs uppercase tracking-widest text-faded text-center py-4">
                  No activity in this category.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeIds.map(id => (
                    <Link
                      key={id}
                      href={`/bounty/${id}`}
                      className="flex items-center justify-between px-4 py-3 border border-ink/15 hover:border-ink/40 hover:bg-paper-deep transition-colors rounded-none group"
                    >
                      <span className="font-numeric text-sm text-ink group-hover:text-blood transition-colors">
                        Bounty #{id}
                      </span>
                      <span className="font-numeric text-xs text-faded">view →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Clean record */}
          {isClean && (
            <div className="parchment p-10 text-center space-y-3">
              <p className="font-display text-2xl font-bold text-ink">No record found.</p>
              <p className="font-body text-sm text-ink-soft">You&apos;re either clean or new.</p>
              <Link href="/create" className="font-numeric uppercase tracking-widest text-blood link text-sm">
                Post a bounty to start your record →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const RapSheetPage: NextPage = () => (
  <ClientOnly
    fallback={
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <span className="loading loading-spinner loading-lg text-blood" />
      </div>
    }
  >
    <RapSheetContent />
  </ClientOnly>
);

export default RapSheetPage;

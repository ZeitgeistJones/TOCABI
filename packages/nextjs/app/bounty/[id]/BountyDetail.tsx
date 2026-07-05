"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import { maxUint256, parseUnits } from "viem";
import { base } from "viem/chains";
import { useAccount } from "wagmi";
import { BountySentence } from "~~/components/BountySentence";
import { ClientOnly } from "~~/components/ClientOnly";
import { Countdown } from "~~/components/Countdown";
import { LedgerTimeline, type LedgerEntry } from "~~/components/LedgerTimeline";
import { PotAmount } from "~~/components/PotAmount";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { SharePosterButton } from "~~/components/SharePosterButton";
import { StatusStamp } from "~~/components/StatusStamp";
import { TwoStepButton } from "~~/components/TwoStepButton";
import {
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const CONTRACT_ADDRESS = "0xDC03A2B68b56dF719aE1f51930bb790e33aDe595" as const;

const useBountyIdFromPath = () => {
  const [id, setId] = useState<bigint | null>(null);
  const [raw, setRaw] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const parts = window.location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("bounty");
    const candidate = idx >= 0 ? parts[idx + 1] : "";
    setRaw(candidate || "");
    if (candidate && /^\d+$/.test(candidate)) {
      try {
        setId(BigInt(candidate));
      } catch {
        setId(null);
      }
    }
  }, []);

  return { id, raw };
};

type LedgerEventItem = {
  args: {
    pledger?: string;
    amount?: bigint;
    claimant?: string;
    submitter?: string;
    proofCID?: string;
    winner?: string;
    payout?: bigint;
    blockTimestamp?: bigint;
  };
  blockNumber?: bigint;
  blockTimestamp?: bigint;
};

const BountyDetailInner = () => {
  const { id: bountyId, raw } = useBountyIdFromPath();
  const { address: connectedAddress, chain: accountChain } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  const { data: bounty } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "bounties",
    args: [bountyId ?? undefined],
  });

  const { data: createdEvents } = useScaffoldEventHistory({
    contractName: "MostClawdWanted",
    eventName: "BountyCreated",
    fromBlock: 0n,
    filters: bountyId !== null ? { id: bountyId } : undefined,
    watch: false,
  });

  const { data: pledgedEvents } = useScaffoldEventHistory({
    contractName: "MostClawdWanted",
    eventName: "Pledged",
    fromBlock: 0n,
    filters: bountyId !== null ? { bountyId } : undefined,
    watch: true,
  });

  const { data: clawdAllowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "allowance",
    args: [connectedAddress, CONTRACT_ADDRESS],
  });

  const { data: clawdBalance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { writeContractAsync: writeClawd } = useScaffoldWriteContract({ contractName: "CLAWD" });
  const { writeContractAsync: writeBounty, isMining } = useScaffoldWriteContract({
    contractName: "MostClawdWanted",
  });

  const [pledgeAmount, setPledgeAmount] = useState<string>("");
  const [proofCID, setProofCID] = useState<string>("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalCooldown, setApprovalCooldown] = useState(false);

  // Extract bounty fields from contract tuple
  const creator = bounty ? (bounty[1] as `0x${string}`) : undefined;
  const descriptionCID = bounty ? (bounty[2] as string) : "";
  const createdAt = bounty ? (bounty[3] as bigint) : 0n;
  const deadline = bounty ? (bounty[4] as bigint) : 0n;
  const totalPledged = bounty ? (bounty[5] as bigint) : 0n;
  const status = bounty ? Number(bounty[6] as number) : 0;
  const resolutionMode = bounty ? Number(bounty[7] as number) : 0;
  const judge = bounty ? (bounty[8] as `0x${string}` | undefined) : undefined;
  const claimMode = bounty ? Number(bounty[11] as number) : 0;
  const currentClaimant = bounty ? (bounty[12] as `0x${string}` | undefined) : undefined;
  const refundPolicy = bounty ? Number(bounty[14] as number) : 0;
  const claimantBps = bounty ? Number(bounty[16] as number) : 7500;
  const treasuryBps = bounty ? Number(bounty[17] as number) : 0;
  const burnBps = bounty ? Number(bounty[18] as number) : 0;
  const challengeWindow = bounty ? (bounty[20] as bigint) : 0n;

  const pledgerCount = useMemo(() => {
    if (!pledgedEvents) return 0;
    const set = new Set<string>();
    for (const ev of pledgedEvents as unknown as LedgerEventItem[]) {
      if (ev.args?.pledger) set.add(ev.args.pledger.toLowerCase());
    }
    return set.size;
  }, [pledgedEvents]);

  const pledgeAmountWei = useMemo(() => {
    if (!pledgeAmount) return 0n;
    try {
      return parseUnits(pledgeAmount, 18);
    } catch {
      return 0n;
    }
  }, [pledgeAmount]);

  const needsApproval = useMemo(() => {
    if (!clawdAllowance || pledgeAmountWei === 0n) return pledgeAmountWei > 0n;
    return (clawdAllowance as bigint) < pledgeAmountWei;
  }, [clawdAllowance, pledgeAmountWei]);

  // Build ledger timeline
  const ledgerEntries = useMemo<LedgerEntry[]>(() => {
    const entries: LedgerEntry[] = [];

    if (createdAt > 0n) {
      entries.push({ type: "created", label: "Bounty posted", timestamp: Number(createdAt) });
    }

    if (pledgedEvents) {
      for (const ev of pledgedEvents as unknown as LedgerEventItem[]) {
        entries.push({
          type: "pledge",
          label: "Pledged CLAWD",
          address: ev.args.pledger,
          amount: ev.args.amount,
          timestamp: ev.blockTimestamp ? Number(ev.blockTimestamp) : undefined,
        });
      }
    }

    return entries.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  }, [createdAt, pledgedEvents]);

  // Event description fallback
  const eventDescriptionCID = useMemo(() => {
    if (!createdEvents || createdEvents.length === 0) return "";
    const first = (createdEvents as unknown as { args: { descriptionCID?: string } }[])[0];
    return first?.args?.descriptionCID ?? "";
  }, [createdEvents]);

  const displayDescription = descriptionCID || eventDescriptionCID;

  const handleApprove = async () => {
    if (approvalSubmitting || approvalCooldown) return;
    try {
      setApprovalSubmitting(true);
      await writeClawd({ functionName: "approve", args: [CONTRACT_ADDRESS, maxUint256] });
      setApprovalCooldown(true);
      setTimeout(() => setApprovalCooldown(false), 4000);
      await refetchAllowance();
    } catch (e) {
      notification.error("Approval failed");
      console.error(e);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handlePledge = async () => {
    if (!bountyId || pledgeAmountWei === 0n) return;
    await writeBounty({ functionName: "pledge", args: [bountyId, pledgeAmountWei] });
    setPledgeAmount("");
  };

  const handleClaim = async () => {
    if (!bountyId) return;
    await writeBounty({ functionName: "claim", args: [bountyId] });
  };

  const handleSubmitProof = async () => {
    if (!bountyId || !proofCID.trim()) return;
    await writeBounty({ functionName: "submitProof", args: [bountyId, proofCID.trim()] });
    setProofCID("");
  };

  // Derived state
  const wrongNetwork = !!connectedAddress && accountChain?.id !== targetNetwork.id;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const canClaim = status === 0 && !!connectedAddress && deadline > 0n && nowSec < deadline;
  const isClaimant =
    status === 1 &&
    currentClaimant &&
    connectedAddress &&
    currentClaimant.toLowerCase() === connectedAddress.toLowerCase();

  const hasJudge = judge && judge !== "0x0000000000000000000000000000000000000000";

  if (raw && bountyId === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-black text-blood mb-2">Case file not found.</h1>
        <p className="font-body text-ink-soft mb-6">That path doesn&apos;t look like a valid bounty ID.</p>
        <Link href="/" className="link font-numeric uppercase tracking-widest">
          ← The Board
        </Link>
      </div>
    );
  }

  if (bountyId === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <span className="loading loading-spinner loading-lg text-blood" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Back */}
      <Link href="/" className="font-numeric text-xs uppercase tracking-widest text-ink-soft link">
        ← The Board
      </Link>

      {/* ── Zone 1: The Poster ── */}
      <section className="parchment relative px-6 py-8 sm:px-10 sm:py-10 overflow-hidden">
        {/* Diagonal PAID stamp when finalized */}
        {status === 3 && <StatusStamp status={status} diagonal />}

        {/* File no. + status + share */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <p className="font-numeric text-xs uppercase tracking-[0.4em] text-ink-soft">
            File No. #{bountyId.toString()}
          </p>
          <div className="flex items-center gap-3">
            <StatusStamp status={status} />
            <SharePosterButton
              bountyId={bountyId}
              title={displayDescription}
              totalPledged={totalPledged}
              status={status}
            />
          </div>
        </div>

        {/* WANTED hero */}
        <div className="text-center mb-6">
          <p className="font-display font-black text-6xl sm:text-8xl tracking-tight text-ink leading-none">WANTED</p>
        </div>

        {/* Bounty title */}
        <h2 className="font-display text-xl sm:text-2xl text-center font-bold text-ink mb-6 leading-snug">
          {displayDescription || "(no description)"}
        </h2>

        {/* Pot */}
        <div className="text-center mb-6">
          <PotAmount amount={totalPledged} size="lg" />
        </div>

        {/* Stats strip */}
        <div
          className="grid grid-cols-3 gap-3 text-center text-xs font-numeric uppercase tracking-widest border-t border-b border-ink/15 py-4 my-4"
        >
          <div>
            <div className="text-faded mb-0.5">Pledgers</div>
            <div className="font-bold text-ink">{pledgerCount}</div>
          </div>
          <div>
            <div className="text-faded mb-0.5">Deadline</div>
            <div className="font-bold text-ink">
              {deadline > 0n ? <Countdown deadline={deadline} className="text-xs" /> : "—"}
            </div>
          </div>
          <div>
            <div className="text-faded mb-0.5">Posted by</div>
            <div>
              {creator && (
                <span className="font-numeric text-xs text-ink-soft">
                  {creator.slice(0, 6)}…{creator.slice(-4)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Plain-English rules */}
        <details className="mt-4">
          <summary className="font-numeric text-xs uppercase tracking-widest text-ink-soft cursor-pointer select-none hover:text-ink transition-colors">
            Fine print ▾
          </summary>
          <div className="mt-3 space-y-1">
            <BountySentence
              resolutionMode={resolutionMode}
              claimMode={claimMode}
              refundPolicy={refundPolicy}
              claimantBps={claimantBps}
              treasuryBps={treasuryBps}
              burnBps={burnBps}
              challengeWindow={challengeWindow}
            />
            {hasJudge && (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-numeric text-xs uppercase tracking-widest text-faded">Judge</span>
                <Address address={judge as `0x${string}`} chain={base} size="xs" />
              </div>
            )}
          </div>
        </details>
      </section>

      {/* ── Zone 2: Action Card ── */}
      <section className="parchment px-6 py-6 space-y-5">
        <h3 className="font-display text-2xl font-bold text-ink">Take Action</h3>

        {!connectedAddress ? (
          <div className="space-y-3">
            <p className="font-body text-sm text-ink-soft">Connect your wallet to pledge or claim.</p>
            <RainbowKitCustomConnectButton />
          </div>
        ) : wrongNetwork ? (
          <div className="space-y-3">
            <p className="font-body text-sm text-ink-soft">Switch to Base to interact with this bounty.</p>
            <RainbowKitCustomConnectButton />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Pledge */}
            {status === 0 && (
              <div className="space-y-2">
                <p className="font-numeric text-xs uppercase tracking-widest text-ink-soft">Add to the pot</p>
                <div className="flex items-center gap-2">
                  <input
                    className="input input-bordered flex-1 font-numeric rounded-none"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount in CLAWD"
                    value={pledgeAmount}
                    onChange={e => setPledgeAmount(e.target.value)}
                  />
                  <span className="font-numeric text-xs text-ink-soft">CLAWD</span>
                </div>
                <p className="font-numeric text-xs text-faded">
                  Your balance:{" "}
                  {clawdBalance ? Number((clawdBalance as bigint) / 10n ** 15n) / 1000 : 0} CLAWD
                </p>
                <div className="flex gap-2">
                  {needsApproval ? (
                    <TwoStepButton
                      label="Approve CLAWD"
                      confirmLabel="Confirm approval"
                      onConfirm={handleApprove}
                      disabled={approvalCooldown || pledgeAmountWei === 0n}
                      loading={approvalSubmitting}
                      variant="secondary"
                      className="flex-1"
                    />
                  ) : (
                    <TwoStepButton
                      label="Pledge CLAWD"
                      confirmLabel="Confirm pledge"
                      onConfirm={handlePledge}
                      disabled={pledgeAmountWei === 0n}
                      loading={isMining}
                      variant="primary"
                      className="flex-1"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Claim */}
            {canClaim && (
              <div className="space-y-2">
                <p className="font-numeric text-xs uppercase tracking-widest text-ink-soft">Stake a claim</p>
                <TwoStepButton
                  label="Claim this bounty"
                  confirmLabel="Lock it in — confirm claim"
                  onConfirm={handleClaim}
                  loading={isMining}
                  variant="secondary"
                />
              </div>
            )}

            {/* Submit proof */}
            {(status === 1 || isClaimant) && (
              <div className="space-y-2">
                <p className="font-numeric text-xs uppercase tracking-widest text-ink-soft">Submit proof</p>
                <input
                  className="input input-bordered w-full font-numeric rounded-none text-sm"
                  placeholder="IPFS CID (Qm… or bafy…)"
                  value={proofCID}
                  onChange={e => setProofCID(e.target.value)}
                />
                <TwoStepButton
                  label="Submit proof"
                  confirmLabel="Submit this CID for review"
                  onConfirm={handleSubmitProof}
                  disabled={!proofCID.trim()}
                  loading={isMining}
                  variant="primary"
                />
              </div>
            )}

            {/* Terminal state message */}
            {status === 3 && (
              <p className="font-display text-lg text-gold font-bold">
                This bounty was built. The pot has been paid out.
              </p>
            )}
            {(status === 4 || status === 5) && (
              <p className="font-body text-sm text-faded">
                This bounty is {status === 4 ? "expired" : "cancelled"}. No further action is available.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Zone 3: Ledger Timeline ── */}
      <section className="parchment px-6 py-6">
        <h3 className="font-display text-xl font-bold text-ink mb-4">Ledger</h3>
        <LedgerTimeline entries={ledgerEntries} />
      </section>

      {/* Footer note */}
      <p className="font-numeric text-xs text-faded text-center uppercase tracking-widest">
        Contract verified on{" "}
        <a
          href={`https://basescan.org/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
          className="link text-ink-soft"
        >
          BaseScan ↗
        </a>
      </p>
    </div>
  );
};

const BountyDetail = () => (
  <ClientOnly
    fallback={
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <span className="loading loading-spinner loading-lg text-blood" />
      </div>
    }
  >
    <BountyDetailInner />
  </ClientOnly>
);

export default BountyDetail;

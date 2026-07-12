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
import { type LedgerEntry, LedgerTimeline } from "~~/components/LedgerTimeline";
import { PotAmount, formatClawd } from "~~/components/PotAmount";
import { SharePosterButton } from "~~/components/SharePosterButton";
import { StatusStamp } from "~~/components/StatusStamp";
import { TwoStepButton } from "~~/components/TwoStepButton";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import {
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";
import { humanizeSeconds } from "~~/utils/bountySentence";
import { notification } from "~~/utils/scaffold-eth";
import { getStatusEntry } from "~~/utils/statusMap";

const CONTRACT_ADDRESS = "0xDC03A2B68b56dF719aE1f51930bb790e33aDe595" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// Contract deployed at Base block ~45,756,919 — same constant the Board uses.
const FROM_BLOCK = 45_670_000n;
// Alchemy allows wide getLogs ranges when filtering by address; this contract is low-volume.
const BLOCKS_BATCH = 500_000;

// Enum indices — mirror MostClawdWanted.sol. statusMap.ts owns Status; these own the rest.
const MODE_TRUSTED_JUDGE = 0;
const MODE_PLEDGER_VOTE = 1;
const MODE_OPTIMISTIC = 2;
const MODE_JUDGE_WITH_OVERRIDE = 3;
const CLAIM_FCFS = 0;
const REFUND_STICKY = 1;

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

type RawEvent = {
  args: Record<string, unknown>;
  blockNumber?: bigint;
  blockTimestamp?: bigint;
};

type ClaimantInfoStruct = {
  hasClaimed: boolean;
  hasSubmitted: boolean;
  approved: boolean;
  rejected: boolean;
  claimDeadline: bigint;
  proofCID: string;
};

type Submission = {
  claimant: string;
  proofCID: string;
  approved: boolean;
  rejected: boolean;
  approveWeight: bigint;
  rejectWeight: bigint;
};

const truncAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const proofUrl = (cid: string) => {
  const c = cid.trim();
  if (c.startsWith("http://") || c.startsWith("https://")) return c;
  if (c.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${c.slice(7)}`;
  return `https://ipfs.io/ipfs/${c}`;
};

/** Old bounties stored raw IPFS CIDs in the description field; new ones store plain English. */
const isLikelyCid = (s: string) => /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]{20,})$/.test(s.trim());

/** Zone 2 shell — one titled parchment section, one primary action inside. */
const ActionCard = ({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <p className="font-numeric text-xs uppercase tracking-widest text-ink-soft m-0">{eyebrow}</p>
    {children}
  </div>
);

const BountyDetailInner = () => {
  const { id: bountyId, raw } = useBountyIdFromPath();
  const { address: connectedAddress, chain: accountChain } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  // ------------------------------------------------------------------
  // Contract reads
  // ------------------------------------------------------------------
  const { data: bounty } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "bounties",
    args: [bountyId ?? undefined],
  });

  const { data: ownerAddress } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "owner",
  });

  const { data: myPledgeRaw } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "pledges",
    args: [bountyId ?? undefined, connectedAddress],
  });

  const { data: myClaimantInfoRaw } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "getClaimantInfo",
    args: [bountyId ?? undefined, connectedAddress],
  });

  const { data: iHaveVoted } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "hasVoted",
    args: [bountyId ?? undefined, connectedAddress],
  });

  const { data: myLastVetoNomination } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "lastVetoNomination",
    args: [bountyId ?? undefined, connectedAddress],
  });

  const { data: vetoWeightRaw } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "judgeVetoWeight",
    args: [bountyId ?? undefined],
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

  // ------------------------------------------------------------------
  // Bounty fields (struct order mirrors MostClawdWanted.sol exactly)
  // ------------------------------------------------------------------
  const b = bounty as readonly unknown[] | undefined;
  const creator = b ? (b[1] as `0x${string}`) : undefined;
  const descriptionCID = b ? (b[2] as string) : "";
  const deadline = b ? (b[4] as bigint) : 0n;
  const totalPledged = b ? (b[5] as bigint) : 0n;
  const status = b ? Number(b[6] as number) : 0;
  const resolutionMode = b ? Number(b[7] as number) : 0;
  const judge = b ? (b[8] as `0x${string}`) : undefined;
  const judgeNominationTime = b ? (b[9] as bigint) : 0n;
  const judgeVetoWindow = b ? (b[10] as bigint) : 0n;
  const claimMode = b ? Number(b[11] as number) : 0;
  const currentClaimant = b ? (b[12] as `0x${string}`) : undefined;
  const claimWindow = b ? (b[13] as bigint) : 0n;
  const refundPolicy = b ? Number(b[14] as number) : 0;
  const refundUnlockTime = b ? (b[15] as bigint) : 0n;
  const claimantBps = b ? Number(b[16] as number) : 7500;
  const treasuryBps = b ? Number(b[17] as number) : 0;
  const burnBps = b ? Number(b[18] as number) : 0;
  const pledgerOverrideBps = b ? Number(b[19] as number) : 0;
  const challengeWindow = b ? (b[20] as bigint) : 0n;
  const resolvedClaimant = b ? (b[21] as `0x${string}`) : undefined;
  const finalizedAt = b ? (b[22] as bigint) : 0n;

  // FCFS: the locked claimant's deadline (for expireClaim + "proof due" countdown)
  const { data: currentClaimantInfoRaw } = useScaffoldReadContract({
    contractName: "MostClawdWanted",
    functionName: "getClaimantInfo",
    args: [bountyId ?? undefined, currentClaimant && currentClaimant !== ZERO_ADDRESS ? currentClaimant : undefined],
  });

  // ------------------------------------------------------------------
  // Event history (all filtered to this bounty; wide batches, low volume)
  // ------------------------------------------------------------------
  const evOpts = { contractName: "MostClawdWanted" as const, fromBlock: FROM_BLOCK, blocksBatchSize: BLOCKS_BATCH };
  const idFilter = bountyId !== null ? { bountyId } : undefined;

  const { data: createdEvents } = useScaffoldEventHistory({
    ...evOpts,
    eventName: "BountyCreated",
    filters: bountyId !== null ? { id: bountyId } : undefined,
    watch: false,
  });
  const { data: pledgedEvents } = useScaffoldEventHistory({
    ...evOpts,
    eventName: "Pledged",
    filters: idFilter,
    watch: true,
  });
  const { data: claimedEvents } = useScaffoldEventHistory({
    ...evOpts,
    eventName: "Claimed",
    filters: idFilter,
    watch: true,
  });
  const { data: proofEvents } = useScaffoldEventHistory({
    ...evOpts,
    eventName: "ProofSubmitted",
    filters: idFilter,
    watch: true,
  });
  const { data: approvedEvents } = useScaffoldEventHistory({
    ...evOpts,
    eventName: "Approved",
    filters: idFilter,
    watch: true,
  });
  const { data: rejectedEvents } = useScaffoldEventHistory({
    ...evOpts,
    eventName: "Rejected",
    filters: idFilter,
    watch: true,
  });
  const { data: votedEvents } = useScaffoldEventHistory({
    ...evOpts,
    eventName: "Voted",
    filters: idFilter,
    watch: true,
  });
  const { data: finalizedEvents } = useScaffoldEventHistory({
    ...evOpts,
    eventName: "Finalized",
    filters: idFilter,
    watch: true,
  });
  const { data: refundedEvents } = useScaffoldEventHistory({
    ...evOpts,
    eventName: "Refunded",
    filters: idFilter,
    watch: false,
  });

  // ------------------------------------------------------------------
  // Writes
  // ------------------------------------------------------------------
  const { writeContractAsync: writeClawd } = useScaffoldWriteContract({ contractName: "CLAWD" });
  const { writeContractAsync: writeBounty, isMining } = useScaffoldWriteContract({
    contractName: "MostClawdWanted",
  });

  // ------------------------------------------------------------------
  // Local state
  // ------------------------------------------------------------------
  const [pledgeAmount, setPledgeAmount] = useState<string>("");
  const [proofCID, setProofCID] = useState<string>("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalCooldown, setApprovalCooldown] = useState(false);
  const [nowSec, setNowSec] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));

  // Keep "now" fresh so windows open/close without a reload.
  useEffect(() => {
    const t = setInterval(() => setNowSec(BigInt(Math.floor(Date.now() / 1000))), 15_000);
    return () => clearInterval(t);
  }, []);

  // ------------------------------------------------------------------
  // Derived — identity & role
  // ------------------------------------------------------------------
  const me = connectedAddress?.toLowerCase();
  const wrongNetwork = !!connectedAddress && accountChain?.id !== targetNetwork.id;
  const statusEntry = getStatusEntry(status);
  const terminal = statusEntry.terminal;

  const hasJudge = !!judge && judge !== ZERO_ADDRESS;
  const iAmCreator = !!me && creator?.toLowerCase() === me;
  const iAmJudge = !!me && hasJudge && judge?.toLowerCase() === me;
  const iAmOwner = !!me && !!ownerAddress && (ownerAddress as string).toLowerCase() === me;
  const canJudgeActions = iAmJudge || (iAmOwner && resolutionMode === MODE_TRUSTED_JUDGE);

  const myPledge = (myPledgeRaw as bigint | undefined) ?? 0n;
  const myInfo = myClaimantInfoRaw as ClaimantInfoStruct | undefined;
  const currentClaimantInfo = currentClaimantInfoRaw as ClaimantInfoStruct | undefined;
  const vetoWeight = (vetoWeightRaw as bigint | undefined) ?? 0n;

  const iAmActiveClaimant =
    !!me &&
    myInfo !== undefined &&
    myInfo.hasClaimed &&
    !myInfo.hasSubmitted &&
    !terminal &&
    (claimMode !== CLAIM_FCFS || currentClaimant?.toLowerCase() === me);

  const myClaimExpired =
    iAmActiveClaimant && claimMode === CLAIM_FCFS && myInfo !== undefined && nowSec > myInfo.claimDeadline;

  const voteMode = resolutionMode === MODE_PLEDGER_VOTE || resolutionMode === MODE_JUDGE_WITH_OVERRIDE;

  // ------------------------------------------------------------------
  // Derived — submissions & tallies (from events)
  // ------------------------------------------------------------------
  const submissions = useMemo<Submission[]>(() => {
    const byAddr = new Map<string, Submission>();
    for (const ev of (proofEvents ?? []) as unknown as RawEvent[]) {
      const claimant = (ev.args.claimant as string | undefined)?.toLowerCase();
      if (!claimant) continue;
      byAddr.set(claimant, {
        claimant,
        proofCID: (ev.args.proofCID as string) ?? "",
        approved: false,
        rejected: false,
        approveWeight: 0n,
        rejectWeight: 0n,
      });
    }
    // Approve / reject: latest event per claimant wins (mirror of contract state flips)
    const decisions: { addr: string; kind: "approved" | "rejected"; block: bigint }[] = [];
    for (const ev of (approvedEvents ?? []) as unknown as RawEvent[]) {
      const addr = (ev.args.claimant as string | undefined)?.toLowerCase();
      if (addr) decisions.push({ addr, kind: "approved", block: ev.blockNumber ?? 0n });
    }
    for (const ev of (rejectedEvents ?? []) as unknown as RawEvent[]) {
      const addr = (ev.args.claimant as string | undefined)?.toLowerCase();
      if (addr) decisions.push({ addr, kind: "rejected", block: ev.blockNumber ?? 0n });
    }
    decisions.sort((a, z) => (a.block < z.block ? -1 : a.block > z.block ? 1 : 0));
    for (const d of decisions) {
      const s = byAddr.get(d.addr);
      if (!s) continue;
      s.approved = d.kind === "approved";
      s.rejected = d.kind === "rejected";
    }
    // Vote tallies
    for (const ev of (votedEvents ?? []) as unknown as RawEvent[]) {
      const candidate = (ev.args.candidate as string | undefined)?.toLowerCase();
      const s = candidate ? byAddr.get(candidate) : undefined;
      if (!s) continue;
      const w = (ev.args.weight as bigint) ?? 0n;
      if (ev.args.approve) s.approveWeight += w;
      else s.rejectWeight += w;
    }
    return Array.from(byAddr.values());
  }, [proofEvents, approvedEvents, rejectedEvents, votedEvents]);

  const pendingForJudge = useMemo(() => submissions.filter(s => !s.approved && !s.rejected), [submissions]);

  // ------------------------------------------------------------------
  // Derived — window availability (mirrors contract checks)
  // ------------------------------------------------------------------
  const voteThreshold = (totalPledged * BigInt(pledgerOverrideBps)) / 10_000n;

  const vetoOpen =
    status === 0 && hasJudge && judgeNominationTime > 0n && nowSec <= judgeNominationTime + judgeVetoWindow;
  const iCanVeto = vetoOpen && myPledge > 0n && (myLastVetoNomination as bigint | undefined) !== judgeNominationTime;

  const iCanNominateJudge = status === 0 && !hasJudge && resolutionMode !== MODE_PLEDGER_VOTE && !!me && !myInfo?.hasClaimed;

  const iCanVote = voteMode && !terminal && myPledge > 0n && iHaveVoted === false && submissions.length > 0;

  // refund() mirror: cancelled/expired → always; sticky → never; claimed/submitted/resolved → never;
  // otherwise (Open, Refundable/Hybrid) → past refundUnlockTime.
  const refundAvailable =
    myPledge > 0n &&
    (status === 4 || status === 5
      ? true
      : refundPolicy === REFUND_STICKY
        ? false
        : status !== 0
          ? false
          : nowSec >= refundUnlockTime);

  const expireClaimReady =
    status === 1 && currentClaimantInfo !== undefined && nowSec > currentClaimantInfo.claimDeadline;

  const expireBountyReady = (status === 0 || status === 1 || status === 2) && nowSec > deadline + challengeWindow;

  const finalizeReady = useMemo(() => {
    if (terminal) return false;
    if (resolutionMode === MODE_TRUSTED_JUDGE || resolutionMode === MODE_JUDGE_WITH_OVERRIDE) {
      return (
        !!resolvedClaimant &&
        resolvedClaimant !== ZERO_ADDRESS &&
        finalizedAt > 0n &&
        nowSec >= finalizedAt + challengeWindow
      );
    }
    if (resolutionMode === MODE_OPTIMISTIC) {
      const candidate = (resolvedClaimant && resolvedClaimant !== ZERO_ADDRESS) || submissions.some(s => !s.rejected);
      return candidate && nowSec >= deadline + challengeWindow;
    }
    // PledgerVote: past deadline + top candidate clears the threshold
    if (nowSec < deadline || voteThreshold === 0n) return false;
    const best = submissions.reduce<bigint>((acc, s) => (s.approveWeight > acc ? s.approveWeight : acc), 0n);
    return best >= voteThreshold;
  }, [
    terminal,
    resolutionMode,
    resolvedClaimant,
    finalizedAt,
    challengeWindow,
    nowSec,
    deadline,
    submissions,
    voteThreshold,
  ]);

  // ------------------------------------------------------------------
  // Derived — pledge input
  // ------------------------------------------------------------------
  const pledgeAmountWei = useMemo(() => {
    if (!pledgeAmount) return 0n;
    try {
      return parseUnits(pledgeAmount, 18);
    } catch {
      return 0n;
    }
  }, [pledgeAmount]);

  const needsApproval = useMemo(() => {
    if (pledgeAmountWei === 0n) return false;
    if (clawdAllowance === undefined) return true;
    return (clawdAllowance as bigint) < pledgeAmountWei;
  }, [clawdAllowance, pledgeAmountWei]);

  // ------------------------------------------------------------------
  // Derived — outcome + ledger
  // ------------------------------------------------------------------
  const finalOutcome = useMemo(() => {
    const evs = (finalizedEvents ?? []) as unknown as RawEvent[];
    if (evs.length === 0) return undefined;
    const ev = evs[evs.length - 1];
    return {
      winner: ev.args.winner as string | undefined,
      claimantAmount: (ev.args.claimantAmount as bigint) ?? 0n,
      treasuryAmount: (ev.args.treasuryAmount as bigint) ?? 0n,
      burnAmount: (ev.args.burnAmount as bigint) ?? 0n,
    };
  }, [finalizedEvents]);

  const ledgerEntries = useMemo<LedgerEntry[]>(() => {
    const rows: (LedgerEntry & { block: bigint })[] = [];
    const push = (ev: RawEvent, type: LedgerEntry["type"], label: string, address?: string, amount?: bigint) =>
      rows.push({
        type,
        label,
        address,
        amount,
        timestamp: ev.blockTimestamp ? Number(ev.blockTimestamp) : undefined,
        block: ev.blockNumber ?? 0n,
      });

    for (const ev of (createdEvents ?? []) as unknown as RawEvent[])
      push(ev, "created", "Bounty posted", ev.args.creator as string | undefined);
    for (const ev of (pledgedEvents ?? []) as unknown as RawEvent[])
      push(ev, "pledge", "Added to the pot", ev.args.pledger as string | undefined, ev.args.amount as bigint);
    for (const ev of (claimedEvents ?? []) as unknown as RawEvent[])
      push(ev, "claim", "Staked a claim", ev.args.claimant as string | undefined);
    for (const ev of (proofEvents ?? []) as unknown as RawEvent[])
      push(ev, "proof", "Submitted proof", ev.args.claimant as string | undefined);
    for (const ev of (approvedEvents ?? []) as unknown as RawEvent[])
      push(ev, "approved", "Work approved", ev.args.claimant as string | undefined);
    for (const ev of (rejectedEvents ?? []) as unknown as RawEvent[])
      push(ev, "rejected", "Work rejected", ev.args.claimant as string | undefined);
    for (const ev of (votedEvents ?? []) as unknown as RawEvent[])
      push(ev, "vote", ev.args.approve ? "Voted to approve" : "Voted to reject", ev.args.voter as string | undefined);
    for (const ev of (refundedEvents ?? []) as unknown as RawEvent[])
      push(ev, "refund", "Took back a pledge", ev.args.pledger as string | undefined, ev.args.amount as bigint);
    for (const ev of (finalizedEvents ?? []) as unknown as RawEvent[])
      push(
        ev,
        "paid",
        "Paid out — bounty built",
        ev.args.winner as string | undefined,
        ev.args.claimantAmount as bigint,
      );

    // Newest first (spec) — order by block number, always present.
    rows.sort((a, z) => (z.block > a.block ? 1 : z.block < a.block ? -1 : 0));
    return rows.map(r => ({
      type: r.type,
      label: r.label,
      address: r.address,
      amount: r.amount,
      timestamp: r.timestamp,
    }));
  }, [
    createdEvents,
    pledgedEvents,
    claimedEvents,
    proofEvents,
    approvedEvents,
    rejectedEvents,
    votedEvents,
    refundedEvents,
    finalizedEvents,
  ]);

  const pledgerCount = useMemo(() => {
    const set = new Set<string>();
    for (const ev of (pledgedEvents ?? []) as unknown as RawEvent[]) {
      const p = ev.args.pledger as string | undefined;
      if (p) set.add(p.toLowerCase());
    }
    return set.size;
  }, [pledgedEvents]);

  const eventDescriptionCID = useMemo(() => {
    const evs = (createdEvents ?? []) as unknown as RawEvent[];
    return evs.length > 0 ? ((evs[0].args.descriptionCID as string) ?? "") : "";
  }, [createdEvents]);
  const displayDescription = descriptionCID || eventDescriptionCID;

  // ------------------------------------------------------------------
  // Handlers — every success toast follows DESIGN_SPEC §4
  // ------------------------------------------------------------------
  const handleApprove = async () => {
    if (approvalSubmitting || approvalCooldown) return;
    try {
      setApprovalSubmitting(true);
      await writeClawd({ functionName: "approve", args: [CONTRACT_ADDRESS, maxUint256] });
      setApprovalCooldown(true);
      setTimeout(() => setApprovalCooldown(false), 4000);
      await refetchAllowance();
      notification.success("CLAWD unlocked. One step left.");
    } catch (e) {
      console.error(e);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handlePledge = async () => {
    if (!bountyId || pledgeAmountWei === 0n) return;
    await writeBounty(
      { functionName: "pledge", args: [bountyId, pledgeAmountWei] },
      { onBlockConfirmation: () => notification.success("Your pledge is on the poster.") },
    );
    setPledgeAmount("");
  };

  const handleClaim = async () => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "claim", args: [bountyId] },
      {
        onBlockConfirmation: () =>
          notification.success(
            claimMode === CLAIM_FCFS
              ? `It's yours. Clock's ticking — ${humanizeSeconds(claimWindow)} left.`
              : "You're on the list. Submit proof when it's built.",
          ),
      },
    );
  };

  const handleSubmitProof = async () => {
    if (!bountyId || !proofCID.trim()) return;
    await writeBounty(
      { functionName: "submitProof", args: [bountyId, proofCID.trim()] },
      { onBlockConfirmation: () => notification.success("Proof's in. Awaiting judgment.") },
    );
    setProofCID("");
  };

  const handleJudgeApprove = async (claimant: string) => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "approve", args: [bountyId, claimant as `0x${string}`] },
      { onBlockConfirmation: () => notification.success("Approved. Challenge window open.") },
    );
  };

  const handleJudgeReject = async (claimant: string) => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "reject", args: [bountyId, claimant as `0x${string}`] },
      { onBlockConfirmation: () => notification.success("Rejected. The hunt continues.") },
    );
  };

  const handleVote = async (candidate: string, approve: boolean) => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "voteResolve", args: [bountyId, candidate as `0x${string}`, approve] },
      { onBlockConfirmation: () => notification.success("Vote's on the record.") },
    );
  };

  const handleVetoJudge = async () => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "vetoJudge", args: [bountyId] },
      { onBlockConfirmation: () => notification.success("Veto registered.") },
    );
  };

  const handleNominateJudge = async () => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "nominateJudge", args: [bountyId] },
      { onBlockConfirmation: () => notification.success("You're the judge now. Veto window open.") },
    );
  };

  const handleFinalize = async () => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "finalize", args: [bountyId] },
      { onBlockConfirmation: () => notification.success("Paid out. Another one built.") },
    );
  };

  const handleRefund = async () => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "refund", args: [bountyId] },
      { onBlockConfirmation: () => notification.success("Your CLAWD is back in your pocket.") },
    );
  };

  const handleExpireClaim = async () => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "expireClaim", args: [bountyId] },
      { onBlockConfirmation: () => notification.success("Slot's free. Someone else can step up.") },
    );
  };

  const handleExpireBounty = async () => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "expireBounty", args: [bountyId] },
      { onBlockConfirmation: () => notification.success("Case closed. Pledgers can take refunds.") },
    );
  };

  const handleCancel = async () => {
    if (!bountyId) return;
    await writeBounty(
      { functionName: "cancelBounty", args: [bountyId] },
      { onBlockConfirmation: () => notification.success("Called off. Pledgers can take refunds.") },
    );
  };

  // ------------------------------------------------------------------
  // Zone 2 pieces
  // ------------------------------------------------------------------
  const PledgeBlock = (
    <ActionCard eyebrow="Add to the pot">
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
      <p className="font-numeric text-xs text-faded m-0">
        Your balance: {clawdBalance !== undefined ? formatClawd(clawdBalance as bigint) : "—"} CLAWD
      </p>
      {needsApproval ? (
        <div className="space-y-1">
          <TwoStepButton
            label="Unlock CLAWD (1/2)"
            confirmLabel="Confirm — unlock CLAWD"
            onConfirm={handleApprove}
            disabled={approvalCooldown || pledgeAmountWei === 0n}
            loading={approvalSubmitting}
            variant="secondary"
            className="w-full"
          />
          <div className="h-1 bg-paper-deep w-full">
            <div className="h-1 w-1/2" style={{ backgroundColor: "#1E3A5F" }} />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <TwoStepButton
            label={pledgeAmountWei > 0n ? "Add to the Pot (2/2)" : "Add to the Pot"}
            confirmLabel="Confirm pledge"
            onConfirm={handlePledge}
            disabled={pledgeAmountWei === 0n}
            loading={isMining}
            variant="primary"
            className="w-full"
          />
          {pledgeAmountWei > 0n && (
            <div className="h-1 bg-paper-deep w-full">
              <div className="h-1 w-full" style={{ backgroundColor: "#8B1A1A" }} />
            </div>
          )}
        </div>
      )}
    </ActionCard>
  );

  // Claim is surfaced as its own secondary block (see showClaimBlock), not a text link.
  const secondaryLinks: { label: string; onClick: () => void; danger?: boolean }[] = [];
  if (refundAvailable && !terminal) {
    secondaryLinks.push({ label: `Take back your pledge (${formatClawd(myPledge)} CLAWD)`, onClick: handleRefund });
  }
  if (iAmCreator && status === 0 && (!currentClaimant || currentClaimant === ZERO_ADDRESS)) {
    secondaryLinks.push({ label: "Call it off (cancel bounty)", onClick: handleCancel, danger: true });
  }
  if (iCanNominateJudge) {
    secondaryLinks.push({ label: "Step up as judge", onClick: handleNominateJudge });
  }
  if (iCanVeto) {
    secondaryLinks.push({
      label: `Veto this judge (your weight: ${formatClawd(myPledge)} of ${formatClawd(voteThreshold)} needed)`,
      onClick: handleVetoJudge,
      danger: true,
    });
  }

  const showClaimBlock =
    status === 0 && !!me && !iAmCreator && !iAmJudge && !myInfo?.hasClaimed && deadline > 0n && nowSec < deadline;

  // Primary card selection — exactly one leads; everything else is secondary.
  const renderActionZone = () => {
    if (!connectedAddress) {
      return (
        <ActionCard eyebrow="Join in">
          <p className="font-body text-sm text-ink-soft m-0">Connect your wallet to pledge, claim, or vote.</p>
          <RainbowKitCustomConnectButton />
        </ActionCard>
      );
    }
    if (wrongNetwork) {
      return (
        <ActionCard eyebrow="Wrong network">
          <p className="font-body text-sm text-ink-soft m-0">Switch to Base to interact with this bounty.</p>
          <RainbowKitCustomConnectButton />
        </ActionCard>
      );
    }

    // 1 — Terminal states
    if (terminal) {
      return (
        <div className="space-y-4">
          {status === 3 && finalOutcome ? (
            <ActionCard eyebrow="Outcome">
              <p className="font-display text-lg text-gold font-bold m-0">This bounty was built.</p>
              <div className="font-numeric text-sm text-ink space-y-0.5">
                {finalOutcome.winner && (
                  <p className="m-0">
                    Builder {truncAddr(finalOutcome.winner)} took home{" "}
                    <span className="text-blood font-bold">{formatClawd(finalOutcome.claimantAmount)} CLAWD</span>
                  </p>
                )}
                {finalOutcome.treasuryAmount > 0n && (
                  <p className="m-0 text-ink-soft">{formatClawd(finalOutcome.treasuryAmount)} CLAWD to the treasury</p>
                )}
                {finalOutcome.burnAmount > 0n && (
                  <p className="m-0 text-ink-soft">{formatClawd(finalOutcome.burnAmount)} CLAWD burned 🔥</p>
                )}
              </div>
            </ActionCard>
          ) : status === 3 ? (
            <p className="font-display text-lg text-gold font-bold m-0">
              This bounty was built. The pot has been paid out.
            </p>
          ) : (
            <ActionCard eyebrow={status === 4 ? "Expired" : "Cancelled"}>
              <p className="font-body text-sm text-faded m-0">
                This bounty is {status === 4 ? "expired" : "cancelled"}.
                {myPledge > 0n ? " Your pledge is waiting for you." : " No further action is available."}
              </p>
              {refundAvailable && (
                <TwoStepButton
                  label={`Take Back Your Pledge (${formatClawd(myPledge)} CLAWD)`}
                  confirmLabel="Confirm refund"
                  onConfirm={handleRefund}
                  loading={isMining}
                  variant="primary"
                />
              )}
            </ActionCard>
          )}
        </div>
      );
    }

    // 2 — Active claimant: proof form front and center
    if (iAmActiveClaimant) {
      return (
        <ActionCard eyebrow="Your move — submit proof">
          {claimMode === CLAIM_FCFS && myInfo && (
            <p className="font-numeric text-xs uppercase tracking-widest m-0">
              {myClaimExpired ? (
                <span className="text-blood">Your claim window has expired — anyone can free the slot.</span>
              ) : (
                <span className="text-ink-soft">
                  Proof due in <Countdown deadline={myInfo.claimDeadline} />
                </span>
              )}
            </p>
          )}
          <input
            className="input input-bordered w-full font-numeric rounded-none text-sm"
            placeholder="IPFS CID or link to the work (Qm…, bafy…, or https://…)"
            value={proofCID}
            onChange={e => setProofCID(e.target.value)}
          />
          <TwoStepButton
            label="Submit Proof"
            confirmLabel="Submit this for review"
            onConfirm={handleSubmitProof}
            disabled={!proofCID.trim() || myClaimExpired}
            loading={isMining}
            variant="primary"
            className="w-full"
          />
        </ActionCard>
      );
    }

    // 3 — Judge with pending submissions
    if (canJudgeActions && pendingForJudge.length > 0) {
      return (
        <ActionCard eyebrow={iAmJudge ? "You're the judge — rule on the work" : "Owner override — rule on the work"}>
          <div className="space-y-3">
            {pendingForJudge.map(s => (
              <div key={s.claimant} className="bg-paper-deep px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-numeric text-sm text-ink">{truncAddr(s.claimant)}</span>
                  {s.proofCID && (
                    <a
                      href={proofUrl(s.proofCID)}
                      target="_blank"
                      rel="noreferrer"
                      className="link font-numeric text-xs uppercase tracking-widest text-claim-blue"
                    >
                      View proof ↗
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <TwoStepButton
                    label="Approve"
                    confirmLabel="Confirm approval"
                    onConfirm={() => handleJudgeApprove(s.claimant)}
                    loading={isMining}
                    variant="primary"
                    className="btn-sm flex-1"
                  />
                  <TwoStepButton
                    label="Reject"
                    confirmLabel="Confirm rejection"
                    onConfirm={() => handleJudgeReject(s.claimant)}
                    loading={isMining}
                    variant="ghost"
                    className="btn-sm flex-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </ActionCard>
      );
    }

    // 4 — Pledger with an open vote
    if (iCanVote) {
      const myShare = totalPledged > 0n ? Number((myPledge * 10_000n) / totalPledged) / 100 : 0;
      return (
        <ActionCard eyebrow="Your move — cast your vote">
          <p className="font-numeric text-xs text-ink-soft m-0">
            Your pledge = {myShare.toFixed(1)}% of the vote.
            {resolutionMode === MODE_PLEDGER_VOTE &&
              ` A submission needs ${formatClawd(voteThreshold)} CLAWD of weight to win.`}
          </p>
          <div className="space-y-3">
            {submissions.map(s => (
              <div key={s.claimant} className="bg-paper-deep px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-numeric text-sm text-ink">{truncAddr(s.claimant)}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-numeric text-xs text-gold">👍 {formatClawd(s.approveWeight)}</span>
                    <span className="font-numeric text-xs text-faded">👎 {formatClawd(s.rejectWeight)}</span>
                    {s.proofCID && (
                      <a
                        href={proofUrl(s.proofCID)}
                        target="_blank"
                        rel="noreferrer"
                        className="link font-numeric text-xs uppercase tracking-widest text-claim-blue"
                      >
                        Proof ↗
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <TwoStepButton
                    label="Vote For"
                    confirmLabel="Confirm — vote for this one"
                    onConfirm={() => handleVote(s.claimant, true)}
                    loading={isMining}
                    variant="primary"
                    className="btn-sm flex-1"
                  />
                  <TwoStepButton
                    label="Vote Against"
                    confirmLabel="Confirm — vote against"
                    onConfirm={() => handleVote(s.claimant, false)}
                    loading={isMining}
                    variant="ghost"
                    className="btn-sm flex-1"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="font-numeric text-xs text-faded m-0">One vote per wallet — make it count.</p>
        </ActionCard>
      );
    }

    // 5 — FCFS claimed by someone else: waiting room
    if (status === 1 && !iAmActiveClaimant) {
      return (
        <ActionCard eyebrow="Claimed — work in progress">
          <p className="font-body text-sm text-ink m-0">
            {currentClaimant && currentClaimant !== ZERO_ADDRESS
              ? `${truncAddr(currentClaimant)} claimed this bounty.`
              : "This bounty is claimed."}
            {currentClaimantInfo && !expireClaimReady && (
              <>
                {" "}
                Proof due in{" "}
                <span className="font-numeric">
                  <Countdown deadline={currentClaimantInfo.claimDeadline} />
                </span>
                .
              </>
            )}
          </p>
          {expireClaimReady && (
            <TwoStepButton
              label="Free Up The Slot"
              confirmLabel="Confirm — reopen this bounty"
              onConfirm={handleExpireClaim}
              loading={isMining}
              variant="secondary"
            />
          )}
        </ActionCard>
      );
    }

    // 6 — Submitted / under review (FCFS only; open modes keep pledging primary while Open)
    if (status === 2) {
      return (
        <ActionCard eyebrow="Under review">
          <p className="font-body text-sm text-ink m-0">
            Work has been submitted{hasJudge ? " — awaiting the judge's ruling" : ""}.
            {resolvedClaimant && resolvedClaimant !== ZERO_ADDRESS && finalizedAt > 0n && !finalizeReady && (
              <>
                {" "}
                Challenge window closes in{" "}
                <span className="font-numeric">
                  <Countdown deadline={finalizedAt + challengeWindow} />
                </span>
                .
              </>
            )}
          </p>
          {finalizeReady && (
            <TwoStepButton
              label="Pay It Out"
              confirmLabel="Confirm — finalize and pay"
              onConfirm={handleFinalize}
              loading={isMining}
              variant="primary"
            />
          )}
        </ActionCard>
      );
    }

    // 7 — Default: open bounty, pledge is primary
    return (
      <div className="space-y-5">
        {submissions.length > 0 && (
          <p className="font-numeric text-xs uppercase tracking-widest text-ink-soft m-0">
            {submissions.length} submission{submissions.length === 1 ? "" : "s"} in so far
            {resolvedClaimant && resolvedClaimant !== ZERO_ADDRESS && finalizedAt > 0n && !finalizeReady && (
              <>
                {" "}
                — challenge window closes in <Countdown deadline={finalizedAt + challengeWindow} />
              </>
            )}
          </p>
        )}
        {nowSec < deadline ? (
          PledgeBlock
        ) : (
          <p className="font-body text-sm text-faded m-0">
            The deadline has passed — no new pledges. Housekeeping actions may be available below.
          </p>
        )}
        {showClaimBlock && (
          <div className="border-t border-ink/10 pt-4">
            <ActionCard eyebrow="Building it instead?">
              <p className="font-body text-sm text-ink-soft m-0">
                {claimMode === CLAIM_FCFS
                  ? `Claim it and you'll have ${humanizeSeconds(claimWindow)} to submit proof.`
                  : "Register your attempt, then submit proof when it's built."}
              </p>
              <TwoStepButton
                label="Claim This Bounty"
                confirmLabel="Lock it in — confirm claim"
                onConfirm={handleClaim}
                loading={isMining}
                variant="secondary"
              />
            </ActionCard>
          </div>
        )}
        {finalizeReady && (
          <div className="border-t border-ink/10 pt-4">
            <ActionCard eyebrow="Ready to settle">
              <TwoStepButton
                label="Pay It Out"
                confirmLabel="Confirm — finalize and pay"
                onConfirm={handleFinalize}
                loading={isMining}
                variant="primary"
              />
            </ActionCard>
          </div>
        )}
      </div>
    );
  };

  // ------------------------------------------------------------------
  // Not found / loading
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Back */}
      <Link href="/" className="font-numeric text-xs uppercase tracking-widest text-ink-soft link">
        ← The Board
      </Link>

      {/* ── Zone 1: The Poster ── */}
      <section
        className={`parchment relative px-6 py-8 sm:px-10 sm:py-10 overflow-hidden ${statusEntry.degraded ? "poster-expired" : ""}`}
      >
        {status === 3 && <StatusStamp status={status} diagonal />}

        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <p className="font-numeric text-xs uppercase tracking-[0.4em] text-ink-soft m-0">
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

        <div className="text-center mb-6">
          <p className="font-display font-black text-6xl sm:text-8xl tracking-tight text-ink leading-none m-0">
            WANTED
          </p>
        </div>

        {isLikelyCid(displayDescription) ? (
          <div className="text-center mb-6">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ink leading-snug m-0">Brief on IPFS</h2>
            <a
              href={proofUrl(displayDescription)}
              target="_blank"
              rel="noreferrer"
              className="link font-numeric text-xs uppercase tracking-widest text-claim-blue"
            >
              View the full brief ↗
            </a>
          </div>
        ) : (
          <h2 className="font-display text-xl sm:text-2xl text-center font-bold text-ink mb-6 leading-snug">
            {displayDescription || "(no description)"}
          </h2>
        )}

        <div className="text-center mb-6">
          <PotAmount amount={totalPledged} size="lg" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs font-numeric uppercase tracking-widest border-t border-b border-ink/15 py-4 my-4">
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
            <div>{creator && <span className="font-numeric text-xs text-ink-soft">{truncAddr(creator)}</span>}</div>
          </div>
        </div>

        {/* Judge line — visible when relevant, not buried in fine print */}
        {hasJudge && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
            <span className="font-numeric text-xs uppercase tracking-widest text-faded">Judge</span>
            <Address address={judge as `0x${string}`} chain={base} size="xs" />
            {vetoOpen && (
              <span className="font-numeric text-xs text-ink-soft">
                — veto window closes in <Countdown deadline={judgeNominationTime + judgeVetoWindow} />
                {vetoWeight > 0n && ` (${formatClawd(vetoWeight)} / ${formatClawd(voteThreshold)} veto weight)`}
              </span>
            )}
          </div>
        )}

        {/* Plain-English rules */}
        <details className="mt-4">
          <summary className="font-numeric text-xs uppercase tracking-widest text-ink-soft cursor-pointer select-none hover:text-ink transition-colors">
            How this bounty works ▾
          </summary>
          <div className="mt-3">
            <BountySentence
              resolutionMode={resolutionMode}
              claimMode={claimMode}
              refundPolicy={refundPolicy}
              claimantBps={claimantBps}
              treasuryBps={treasuryBps}
              burnBps={burnBps}
              challengeWindow={challengeWindow}
              pledgerOverrideBps={pledgerOverrideBps}
            />
          </div>
        </details>
      </section>

      {/* ── Zone 2: Your Move ── */}
      <section className="parchment px-6 py-6 space-y-5">
        <h3 className="font-display text-2xl font-bold text-ink m-0">Your Move</h3>
        {renderActionZone()}

        {/* Secondary actions — small text links, never competing buttons */}
        {connectedAddress && !wrongNetwork && secondaryLinks.length > 0 && (
          <div className="border-t border-ink/10 pt-3 flex flex-wrap gap-x-5 gap-y-1">
            {secondaryLinks.map(link => (
              <button
                key={link.label}
                onClick={link.onClick}
                disabled={isMining}
                className={`link font-numeric text-xs uppercase tracking-widest cursor-pointer bg-transparent border-0 p-0 ${
                  link.danger ? "text-blood" : "text-ink-soft"
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        )}

        {/* Housekeeping — anyone can tidy the town */}
        {connectedAddress && !wrongNetwork && !terminal && expireBountyReady && (
          <div className="border-t border-ink/10 pt-3">
            <button
              onClick={handleExpireBounty}
              disabled={isMining}
              className="link font-numeric text-xs uppercase tracking-widest text-faded cursor-pointer bg-transparent border-0 p-0"
            >
              Close the case (expire this bounty — deadline long gone)
            </button>
          </div>
        )}
      </section>

      {/* ── Zone 3: The Ledger ── */}
      <section className="parchment px-6 py-6">
        <h3 className="font-display text-xl font-bold text-ink mb-4">The Ledger</h3>
        <LedgerTimeline entries={ledgerEntries} collapseAfter={5} />
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

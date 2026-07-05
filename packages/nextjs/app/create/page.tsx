"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressInput } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { BountySentence } from "~~/components/BountySentence";
import { ClientOnly } from "~~/components/ClientOnly";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type ResolutionMode = 0 | 1 | 2;
type ClaimMode = 0 | 1 | 2;
type RefundPolicy = 0 | 1 | 2;

type Preset = {
  name: string;
  tagline: string;
  description: string;
  resolutionMode: ResolutionMode;
  claimMode: ClaimMode;
  refundPolicy: RefundPolicy;
  claimantBps: number;
  treasuryBps: number;
  burnBps: number;
};

const PRESETS: Preset[] = [
  {
    name: "Quick Task",
    tagline: "First to claim, judge decides",
    description: "Trusted judge, first-come-first-served. Good for well-defined tasks.",
    resolutionMode: 0,
    claimMode: 0,
    refundPolicy: 0,
    claimantBps: 8500,
    treasuryBps: 1000,
    burnBps: 500,
  },
  {
    name: "Community Vote",
    tagline: "Pledgers pick the winner",
    description: "Open to all builders, pledgers vote on the best submission.",
    resolutionMode: 1,
    claimMode: 2,
    refundPolicy: 0,
    claimantBps: 8000,
    treasuryBps: 1000,
    burnBps: 1000,
  },
  {
    name: "Set & Forget",
    tagline: "Auto-resolves, pledges are sticky",
    description: "Optimistic resolution. Pays out after challenge window with no objection.",
    resolutionMode: 2,
    claimMode: 1,
    refundPolicy: 1,
    claimantBps: 9000,
    treasuryBps: 500,
    burnBps: 500,
  },
];

// ---
// Split donut — simple SVG showing claimant/treasury/burn breakdown
// ---
const SplitDonut = ({
  claimantBps,
  treasuryBps,
  burnBps,
}: {
  claimantBps: number;
  treasuryBps: number;
  burnBps: number;
}) => {
  const total = claimantBps + treasuryBps + burnBps;
  if (total === 0) return null;

  const r = 40;
  const cx = 50;
  const cy = 50;
  const circ = 2 * Math.PI * r;

  const claimantFrac = claimantBps / total;
  const treasuryFrac = treasuryBps / total;
  const burnFrac = burnBps / total;

  const segments = [
    { frac: claimantFrac, color: "#8B1A1A", label: `Builder ${(claimantBps / 100).toFixed(0)}%` },
    { frac: treasuryFrac, color: "#1E3A5F", label: `Treasury ${(treasuryBps / 100).toFixed(0)}%` },
    { frac: burnFrac, color: "#B7A88C", label: `Burn ${(burnBps / 100).toFixed(0)}%` },
  ].filter(s => s.frac > 0);

  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="80" height="80" viewBox="0 0 100 100" className="shrink-0">
        {segments.map((seg, i) => {
          const dashLen = seg.frac * circ;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${dashLen} ${circ - dashLen}`}
              strokeDashoffset={-offset * circ}
              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
            />
          );
          offset += seg.frac;
          return el;
        })}
        <circle cx={cx} cy={cy} r={r - 10} fill="#EDE0C4" />
      </svg>
      <div className="space-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="font-numeric text-xs text-ink-soft">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---
// Field wrapper
// ---
const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="font-numeric uppercase tracking-widest text-xs text-ink-soft mb-1 block">{label}</label>
    {children}
    {hint && <p className="font-body text-xs text-faded mt-1">{hint}</p>}
  </div>
);

// ---
// Step indicator
// ---
const StepDots = ({ step, total }: { step: number; total: number }) => (
  <div className="flex items-center gap-2 justify-center mb-8">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 transition-all ${
          i < step ? "w-6 bg-blood" : i === step ? "w-6 bg-blood" : "w-3 bg-ink/20"
        }`}
        style={{ borderRadius: 0 }}
      />
    ))}
  </div>
);

// ---
// Main wizard
// ---
const CreateWizard = () => {
  const router = useRouter();
  const { address: connectedAddress, chain: accountChain } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "MostClawdWanted" });

  const [step, setStep] = useState(0);

  // Step 1 fields
  const [descriptionCID, setDescriptionCID] = useState("");
  const [deadlineStr, setDeadlineStr] = useState("");

  // Step 2 fields
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>(0);
  const [judge, setJudge] = useState<string>("");
  const [judgeVetoWindowDays, setJudgeVetoWindowDays] = useState<number>(2);
  const [claimMode, setClaimMode] = useState<ClaimMode>(0);
  const [claimWindowHours, setClaimWindowHours] = useState<number>(24);
  const [refundPolicy, setRefundPolicy] = useState<RefundPolicy>(0);
  const [claimantBps, setClaimantBps] = useState<number>(8500);
  const [treasuryBps, setTreasuryBps] = useState<number>(1000);
  const [burnBps, setBurnBps] = useState<number>(500);
  const [pledgerOverrideBps, setPledgerOverrideBps] = useState<number>(2500);
  const [challengeWindowDays, setChallengeWindowDays] = useState<number>(3);

  const totalBps = claimantBps + treasuryBps + burnBps;
  const splitsValid = totalBps === 10000;

  const deadlineUnix = useMemo(() => {
    if (!deadlineStr) return 0n;
    const t = new Date(deadlineStr).getTime();
    if (Number.isNaN(t)) return 0n;
    return BigInt(Math.floor(t / 1000));
  }, [deadlineStr]);

  const wrongNetwork = !!connectedAddress && accountChain?.id !== targetNetwork.id;

  const applyPreset = (i: number) => {
    const p = PRESETS[i];
    setSelectedPreset(i);
    setResolutionMode(p.resolutionMode);
    setClaimMode(p.claimMode);
    setRefundPolicy(p.refundPolicy);
    setClaimantBps(p.claimantBps);
    setTreasuryBps(p.treasuryBps);
    setBurnBps(p.burnBps);
  };

  const validateStep1 = (): string | null => {
    if (!descriptionCID.trim()) return "Description CID is required.";
    if (deadlineUnix === 0n) return "Deadline is required.";
    if (deadlineUnix <= BigInt(Math.floor(Date.now() / 1000))) return "Deadline must be in the future.";
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!splitsValid) return "Splits must add up to 100%.";
    if (resolutionMode === 0 && (!judge || !isAddress(judge))) return "TrustedJudge mode requires a valid address.";
    return null;
  };

  const handleNext = () => {
    if (step === 0) {
      const err = validateStep1();
      if (err) { notification.error(err); return; }
    }
    if (step === 1) {
      const err = validateStep2();
      if (err) { notification.error(err); return; }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    const judgeArg = resolutionMode === 0 ? (judge as `0x${string}`) : (ZERO_ADDRESS as `0x${string}`);
    try {
      await writeContractAsync({
        functionName: "createBounty",
        args: [
          descriptionCID.trim(),
          deadlineUnix,
          resolutionMode,
          judgeArg,
          BigInt(judgeVetoWindowDays * 86400),
          claimMode,
          BigInt(claimWindowHours * 3600),
          refundPolicy,
          0n,
          claimantBps,
          treasuryBps,
          burnBps,
          pledgerOverrideBps,
          BigInt(challengeWindowDays * 86400),
        ],
      });
      notification.success("Contract posted. The streets will know shortly.");
      router.push("/");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <StepDots step={step} total={3} />

      {/* ── Step 1: What ── */}
      {step === 0 && (
        <div className="parchment px-6 py-8 space-y-5">
          <div>
            <h2 className="font-display text-2xl font-black text-blood">What do you want built?</h2>
            <p className="font-body text-sm text-ink-soft mt-1">Paste an IPFS CID describing the task in plain English.</p>
          </div>

          <Field label="Description CID" hint="Upload your brief to IPFS, paste the CID here.">
            <input
              className="input input-bordered w-full font-numeric rounded-none"
              placeholder="Qm… or bafy…"
              value={descriptionCID}
              onChange={e => setDescriptionCID(e.target.value)}
            />
          </Field>

          <Field label="Deadline" hint="When the bounty expires if unfilled.">
            <input
              className="input input-bordered w-full font-numeric rounded-none"
              type="datetime-local"
              value={deadlineStr}
              onChange={e => setDeadlineStr(e.target.value)}
            />
          </Field>

          <button className="btn btn-primary w-full rounded-none" onClick={handleNext}>
            <span className="font-numeric uppercase tracking-widest">Set the Rules →</span>
          </button>
        </div>
      )}

      {/* ── Step 2: How ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="parchment px-6 py-6">
            <h2 className="font-display text-2xl font-black text-blood mb-4">How should it work?</h2>

            {/* Presets */}
            <div className="space-y-2 mb-5">
              {PRESETS.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(i)}
                  className={`w-full text-left px-4 py-3 border transition-colors rounded-none ${
                    selectedPreset === i
                      ? "border-blood bg-blood/5"
                      : "border-ink/15 hover:border-ink/40 bg-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-bold text-ink leading-none mb-0.5">{p.name}</p>
                      <p className="font-numeric text-xs text-ink-soft uppercase tracking-widest">{p.tagline}</p>
                    </div>
                    {selectedPreset === i && (
                      <span className="stamp stamp-ink text-xs shrink-0 mt-0.5">Selected</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Split preview */}
            <div className="border-t border-ink/10 pt-4">
              <p className="font-numeric text-xs uppercase tracking-widest text-ink-soft mb-3">Payout split</p>
              <SplitDonut claimantBps={claimantBps} treasuryBps={treasuryBps} burnBps={burnBps} />
            </div>
          </div>

          {/* Fine print — advanced settings */}
          <details className="parchment px-6 py-4">
            <summary className="font-numeric text-xs uppercase tracking-widest text-ink-soft cursor-pointer select-none hover:text-ink transition-colors">
              Fine print — advanced settings ▾
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Resolution mode">
                  <select
                    className="select select-bordered w-full rounded-none"
                    value={resolutionMode}
                    onChange={e => { setResolutionMode(Number(e.target.value) as ResolutionMode); setSelectedPreset(null); }}
                  >
                    <option value={0}>TrustedJudge</option>
                    <option value={1}>PledgerVote</option>
                    <option value={2}>Optimistic</option>
                  </select>
                </Field>
                <Field label="Claim mode">
                  <select
                    className="select select-bordered w-full rounded-none"
                    value={claimMode}
                    onChange={e => { setClaimMode(Number(e.target.value) as ClaimMode); setSelectedPreset(null); }}
                  >
                    <option value={0}>FCFS</option>
                    <option value={1}>OpenFirstValid</option>
                    <option value={2}>OpenJudgePicks</option>
                  </select>
                </Field>
                <Field label="Refund policy">
                  <select
                    className="select select-bordered w-full rounded-none"
                    value={refundPolicy}
                    onChange={e => { setRefundPolicy(Number(e.target.value) as RefundPolicy); setSelectedPreset(null); }}
                  >
                    <option value={0}>Refundable</option>
                    <option value={1}>Sticky</option>
                    <option value={2}>Burn</option>
                  </select>
                </Field>
              </div>

              {resolutionMode === 0 && (
                <Field label="Judge address" hint="Who approves or rejects submitted work.">
                  <AddressInput
                    value={judge}
                    onChange={(value: string) => setJudge(value)}
                    placeholder="0x… or vitalik.eth"
                  />
                </Field>
              )}

              {/* Splits */}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Builder %">
                  <input
                    type="number" min={0} max={100} step={0.01}
                    className="input input-bordered w-full font-numeric rounded-none"
                    value={(claimantBps / 100).toString()}
                    onChange={e => { setClaimantBps(Math.round(Number(e.target.value || "0") * 100)); setSelectedPreset(null); }}
                  />
                </Field>
                <Field label="Treasury %">
                  <input
                    type="number" min={0} max={100} step={0.01}
                    className="input input-bordered w-full font-numeric rounded-none"
                    value={(treasuryBps / 100).toString()}
                    onChange={e => { setTreasuryBps(Math.round(Number(e.target.value || "0") * 100)); setSelectedPreset(null); }}
                  />
                </Field>
                <Field label="Burn %">
                  <input
                    type="number" min={0} max={100} step={0.01}
                    className="input input-bordered w-full font-numeric rounded-none"
                    value={(burnBps / 100).toString()}
                    onChange={e => { setBurnBps(Math.round(Number(e.target.value || "0") * 100)); setSelectedPreset(null); }}
                  />
                </Field>
              </div>
              <p className={`font-numeric text-xs uppercase tracking-widest ${splitsValid ? "text-faded" : "text-blood"}`}>
                Total: {(totalBps / 100).toFixed(2)}% {splitsValid ? "✓" : "— must equal 100%"}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Challenge window">
                  <select
                    className="select select-bordered w-full rounded-none"
                    value={challengeWindowDays}
                    onChange={e => setChallengeWindowDays(Number(e.target.value))}
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                  </select>
                </Field>
                <Field label="Pledger override %">
                  <input
                    type="number" min={0} max={100} step={0.01}
                    className="input input-bordered w-full font-numeric rounded-none"
                    value={(pledgerOverrideBps / 100).toString()}
                    onChange={e => setPledgerOverrideBps(Math.round(Number(e.target.value || "0") * 100))}
                  />
                </Field>
                <Field label="Claim window (hours)">
                  <input
                    type="number" min={1} step={1}
                    className="input input-bordered w-full font-numeric rounded-none"
                    value={claimWindowHours.toString()}
                    onChange={e => setClaimWindowHours(Number(e.target.value || "1"))}
                  />
                </Field>
              </div>

              {resolutionMode === 0 && (
                <Field label="Judge veto window (days)">
                  <input
                    type="number" min={0} step={1}
                    className="input input-bordered w-full font-numeric rounded-none"
                    value={judgeVetoWindowDays.toString()}
                    onChange={e => setJudgeVetoWindowDays(Number(e.target.value || "0"))}
                  />
                </Field>
              )}
            </div>
          </details>

          {/* Navigation */}
          <div className="flex gap-3">
            <button className="btn btn-ghost rounded-none flex-1 font-numeric uppercase tracking-widest text-xs" onClick={() => setStep(0)}>
              ← Back
            </button>
            <button className="btn btn-primary rounded-none flex-1" onClick={handleNext}>
              <span className="font-numeric uppercase tracking-widest">Review →</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="parchment px-6 py-8">
            <h2 className="font-display text-2xl font-black text-blood mb-1">Read it back</h2>
            <p className="font-body text-sm text-ink-soft mb-6">This is how the contract will read on-chain. No take-backs.</p>

            {/* Description */}
            <div className="mb-4">
              <p className="font-numeric text-xs uppercase tracking-widest text-faded mb-1">CID</p>
              <p className="font-numeric text-sm text-ink break-all">{descriptionCID}</p>
            </div>

            {/* Deadline */}
            <div className="mb-4">
              <p className="font-numeric text-xs uppercase tracking-widest text-faded mb-1">Deadline</p>
              <p className="font-numeric text-sm text-ink">
                {deadlineStr ? new Date(deadlineStr).toLocaleString() : "—"}
              </p>
            </div>

            {/* Plain-English rules */}
            <div className="border-t border-ink/10 pt-4 mb-4">
              <p className="font-numeric text-xs uppercase tracking-widest text-faded mb-3">How it works</p>
              <BountySentence
                resolutionMode={resolutionMode}
                claimMode={claimMode}
                refundPolicy={refundPolicy}
                claimantBps={claimantBps}
                treasuryBps={treasuryBps}
                burnBps={burnBps}
                challengeWindow={BigInt(challengeWindowDays * 86400)}
              />
            </div>

            {/* Split donut */}
            <div className="border-t border-ink/10 pt-4">
              <SplitDonut claimantBps={claimantBps} treasuryBps={treasuryBps} burnBps={burnBps} />
            </div>
          </div>

          {/* Submit */}
          <div className="parchment px-6 py-6 space-y-3">
            {!connectedAddress ? (
              <div className="space-y-2">
                <p className="font-body text-sm text-ink-soft">Connect your wallet to post.</p>
                <RainbowKitCustomConnectButton />
              </div>
            ) : wrongNetwork ? (
              <div className="space-y-2">
                <p className="font-body text-sm text-ink-soft">Switch to Base to continue.</p>
                <RainbowKitCustomConnectButton />
              </div>
            ) : (
              <button
                className="btn btn-primary w-full rounded-none"
                disabled={isMining || !splitsValid}
                onClick={handleSubmit}
              >
                {isMining && <span className="loading loading-spinner loading-sm" />}
                <span className="font-numeric uppercase tracking-widest">
                  {isMining ? "Posting…" : "Put a contract out"}
                </span>
              </button>
            )}
            <button
              className="btn btn-ghost w-full rounded-none font-numeric uppercase tracking-widest text-xs"
              onClick={() => setStep(1)}
              disabled={isMining}
            >
              ← Back
            </button>
            <p className="font-numeric text-xs text-faded text-center uppercase tracking-widest">
              Questions? See House Rules in the footer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const CreatePage: NextPage = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="font-display font-black text-5xl md:text-6xl tracking-tight text-blood mb-1">Put a Contract Out</h1>
        <p className="font-numeric uppercase tracking-[0.25em] text-ink-soft text-xs">
          name the target. set the rules. fund the reward.
        </p>
      </div>
      <ClientOnly
        fallback={
          <div className="parchment p-12 text-center">
            <span className="loading loading-spinner loading-lg text-blood" />
          </div>
        }
      >
        <CreateWizard />
      </ClientOnly>
    </div>
  );
};

export default CreatePage;

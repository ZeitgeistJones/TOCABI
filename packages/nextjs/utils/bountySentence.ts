/**
 * bountySentence — converts raw contract parameters into plain-English
 * sentences that anyone (not just devs) can read and understand.
 *
 * ENUM ORDER IS COPIED FROM MostClawdWanted.sol — the single source of truth.
 * If the contract ever changes, update here and nowhere else.
 *
 *   ResolutionMode: 0 = TrustedJudge, 1 = PledgerVote, 2 = Optimistic, 3 = JudgeWithOverride
 *   ClaimMode:      0 = FCFS,         1 = OpenJudgePicks, 2 = OpenFirstValid
 *   RefundPolicy:   0 = Refundable,   1 = Sticky,         2 = Hybrid
 */

export type BountyParams = {
  /** 0 = TrustedJudge, 1 = PledgerVote, 2 = Optimistic, 3 = JudgeWithOverride */
  resolutionMode: number;
  /** 0 = FCFS, 1 = OpenJudgePicks, 2 = OpenFirstValid */
  claimMode: number;
  /** 0 = Refundable, 1 = Sticky, 2 = Hybrid */
  refundPolicy: number;
  /** Basis points to claimant (out of 10000) */
  claimantBps: number;
  /** Basis points to treasury */
  treasuryBps: number;
  /** Basis points burned */
  burnBps: number;
  /** Challenge window in seconds */
  challengeWindow: bigint;
  /** Pledger override / vote threshold in basis points (optional — enriches vote-mode sentences) */
  pledgerOverrideBps?: number;
};

// ---
// Helpers
// ---

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export function humanizeSeconds(seconds: bigint | number): string {
  const s = Number(seconds);
  if (s <= 0) return "no time";
  if (s < 3600) return `${Math.round(s / 60)} minutes`;
  if (s < 86400) return `${Math.round(s / 3600)} hours`;
  const d = Math.round(s / 86400);
  return d === 1 ? "24 hours" : `${d} days`;
}

// ---
// Claim mode sentence
// ---
function claimSentence(claimMode: number): string {
  switch (claimMode) {
    case 0: // FCFS
      return "The first builder to claim it gets the shot";
    case 1: // OpenJudgePicks
      return "Any builder can submit work — the judge picks the winner";
    case 2: // OpenFirstValid
      return "Any builder can submit work — the first valid submission wins";
    default:
      return "Claim rules are custom";
  }
}

// ---
// Resolution sentence
// ---
function resolutionSentence(resolutionMode: number, challengeWindow: bigint, pledgerOverrideBps?: number): string {
  const window = humanizeSeconds(challengeWindow);
  const pct = pledgerOverrideBps !== undefined ? bpsToPercent(pledgerOverrideBps) : "a share";
  switch (resolutionMode) {
    case 0: // TrustedJudge
      return `A judge approves or rejects the work, then a ${window} challenge window runs before payout`;
    case 1: // PledgerVote
      return `Pledgers vote on submissions — the top pick needs ${pct} of the pot's weight to win, settled after the deadline`;
    case 2: // Optimistic
      return `Work auto-resolves ${window} after the deadline if nobody objects`;
    case 3: // JudgeWithOverride
      return `The judge picks a winner, but pledgers holding ${pct} of the pot can override — after a ${window} challenge window`;
    default:
      return "Resolution is custom";
  }
}

// ---
// Payout sentence
// ---
function payoutSentence(claimantBps: number, treasuryBps: number, burnBps: number): string {
  const claimant = bpsToPercent(claimantBps);
  const parts: string[] = [`${claimant} goes to the builder`];
  if (treasuryBps > 0) parts.push(`${bpsToPercent(treasuryBps)} to the TOCABI treasury`);
  if (burnBps > 0) parts.push(`${bpsToPercent(burnBps)} is burned`);
  return parts.join(", ");
}

// ---
// Refund sentence — mirrors refund() in MostClawdWanted.sol exactly:
//   Cancelled / Expired  → always refundable, any policy
//   Sticky               → otherwise never refundable
//   Refundable / Hybrid  → refundable only while Open and past refundUnlockTime
// ---
function refundSentence(refundPolicy: number): string {
  switch (refundPolicy) {
    case 0: // Refundable
      return "Pledgers can pull their CLAWD back while it's still open (after the unlock time), or any time if it's cancelled or expires";
    case 1: // Sticky
      return "Pledges are locked in — refunds only if the bounty is cancelled or expires";
    case 2: // Hybrid
      return "Pledges unlock for refund after the unlock time while the bounty is still open, or any time if it's cancelled or expires";
    default:
      return "";
  }
}

// ---
// Main export
// ---
export function bountySentence({
  resolutionMode,
  claimMode,
  refundPolicy,
  claimantBps,
  treasuryBps,
  burnBps,
  challengeWindow,
  pledgerOverrideBps,
}: BountyParams): string[] {
  return [
    `${claimSentence(claimMode)}.`,
    `${resolutionSentence(resolutionMode, challengeWindow, pledgerOverrideBps)}.`,
    `Payout: ${payoutSentence(claimantBps, treasuryBps, burnBps)}.`,
    `${refundSentence(refundPolicy)}.`,
  ].filter(s => s !== ".");
}

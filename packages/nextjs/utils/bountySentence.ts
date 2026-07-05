/**
 * bountySentence — converts raw contract parameters into a single plain-English
 * sentence that anyone (not just devs) can read and understand.
 *
 * Example output:
 * "First builder to claim and submit proof wins 75% of the pot.
 *  A trusted judge has 7 days to approve after submission.
 *  If unclaimed by the deadline, pledgers get their CLAWD back."
 */

export type BountyParams = {
  /** 0 = TrustedJudge, 1 = PledgerVote, 2 = Optimistic */
  resolutionMode: number;
  /** 0 = FCFS, 1 = OpenFirstValid, 2 = OpenJudgePicks */
  claimMode: number;
  /** 0 = Refundable, 1 = Sticky, 2 = Burn */
  refundPolicy: number;
  /** Basis points to claimant (out of 10000) */
  claimantBps: number;
  /** Basis points to treasury */
  treasuryBps: number;
  /** Basis points burned */
  burnBps: number;
  /** Challenge window in seconds */
  challengeWindow: bigint;
};

// ---
// Helpers
// ---

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

function formatChallengeWindow(seconds: bigint): string {
  const s = Number(seconds);
  if (s === 0) return "no challenge window";
  if (s < 3600) return `${Math.round(s / 60)} minutes`;
  if (s < 86400) return `${Math.round(s / 3600)} hours`;
  return `${Math.round(s / 86400)} days`;
}

// ---
// Claim mode sentence
// ---
function claimSentence(claimMode: number): string {
  switch (claimMode) {
    case 0:
      return "The first builder to claim it gets the shot";
    case 1:
      return "Any builder can submit proof — the best one wins";
    case 2:
      return "The judge picks the winner from all submissions";
    default:
      return "Claim rules are custom";
  }
}

// ---
// Resolution sentence
// ---
function resolutionSentence(resolutionMode: number, challengeWindow: bigint): string {
  const window = formatChallengeWindow(challengeWindow);
  switch (resolutionMode) {
    case 0:
      return `A trusted judge approves or rejects the work — challenge window is ${window}`;
    case 1:
      return `Pledgers vote to approve — challenge window is ${window}`;
    case 2:
      return `Work auto-resolves after a ${window} challenge window with no objection`;
    default:
      return `Resolution is custom`;
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
// Refund sentence
// ---
function refundSentence(refundPolicy: number): string {
  switch (refundPolicy) {
    case 0:
      return "If it expires unclaimed, pledgers get their CLAWD back";
    case 1:
      return "Pledges are non-refundable regardless of outcome";
    case 2:
      return "If it expires unclaimed, pledged CLAWD is burned";
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
}: BountyParams): string[] {
  return [
    `${claimSentence(claimMode)}.`,
    `${resolutionSentence(resolutionMode, challengeWindow)}.`,
    `Payout: ${payoutSentence(claimantBps, treasuryBps, burnBps)}.`,
    `${refundSentence(refundPolicy)}.`,
  ].filter(Boolean);
}

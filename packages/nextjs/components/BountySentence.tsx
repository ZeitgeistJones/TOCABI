import { type BountyParams, bountySentence } from "~~/utils/bountySentence";

type BountySentenceProps = BountyParams & {
  className?: string;
};

/**
 * Renders the plain-English rules summary for a bounty.
 * One paragraph per sentence from bountySentence.ts.
 */
export const BountySentence = ({
  resolutionMode,
  claimMode,
  refundPolicy,
  claimantBps,
  treasuryBps,
  burnBps,
  challengeWindow,
  pledgerOverrideBps,
  className = "",
}: BountySentenceProps) => {
  const sentences = bountySentence({
    resolutionMode,
    claimMode,
    refundPolicy,
    claimantBps,
    treasuryBps,
    burnBps,
    challengeWindow,
    pledgerOverrideBps,
  });

  return (
    <div className={`space-y-1.5 ${className}`}>
      {sentences.map((s, i) => (
        <p key={i} className="font-body text-sm text-ink leading-relaxed m-0">
          {s}
        </p>
      ))}
    </div>
  );
};

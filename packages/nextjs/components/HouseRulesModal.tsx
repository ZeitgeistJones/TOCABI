"use client";

const CONTRACT_ADDRESS = "0xDC03A2B68b56dF719aE1f51930bb790e33aDe595";

const rules = [
  "Pledging CLAWD means locking it until the bounty resolves or your refund policy allows withdrawal.",
  "The bounty creator sets the rules when posting — read the bounty sentence before pledging.",
  "For FCFS bounties, the first person to claim has a fixed window to submit proof. Miss it and the slot resets.",
  "Judges approve or reject submitted work. In TrustedJudge mode, the bounty owner can also approve.",
  "After approval, there's a challenge window before payout can be finalized. Use that time to object.",
  "Pledgers can veto a nominated judge during the veto window by signing a rejection.",
  "In PledgerVote mode, your vote weight equals your share of the total pot.",
  "Payout splits (claimant / treasury / burn) are set at creation and can't change.",
  "Anyone can call expireBounty() on an unresolved bounty past its deadline + challenge window.",
  "Code is law — the contract is verified on BaseScan. When in doubt, read it.",
];

/**
 * Footer modal summarising platform rules in plain English.
 * Replaces the /code page. Triggered by a footer link.
 */
export const HouseRulesModal = () => {
  return (
    <>
      <label htmlFor="house-rules-modal" className="cursor-pointer font-numeric text-xs uppercase tracking-widest link">
        House Rules
      </label>

      <input type="checkbox" id="house-rules-modal" className="modal-toggle" />
      <div className="modal modal-bottom sm:modal-middle" role="dialog">
        <div className="modal-box parchment rounded-none max-w-xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display text-2xl font-black text-blood">House Rules</h3>
              <p className="font-numeric text-xs uppercase tracking-widest text-ink-soft mt-0.5">
                How this town works
              </p>
            </div>
            <label htmlFor="house-rules-modal" className="btn btn-ghost btn-sm rounded-none opacity-60 hover:opacity-100">
              ✕
            </label>
          </div>

          <ol className="space-y-3 font-body text-sm">
            {rules.map((rule, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-numeric text-blood font-bold shrink-0 mt-0.5">{i + 1}.</span>
                <span className="text-ink">{rule}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 pt-4 border-t border-ink/15">
            <a
              href={`https://basescan.org/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="font-numeric text-xs uppercase tracking-widest link text-blood"
            >
              Read the contract on BaseScan ↗
            </a>
          </div>
        </div>
        <label className="modal-backdrop" htmlFor="house-rules-modal" />
      </div>
    </>
  );
};

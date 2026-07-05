import { formatUnits } from "viem";

type PotAmountProps = {
  /** Raw amount in wei (18 decimals) */
  amount: bigint;
  /** Display size: "lg" for poster hero, "md" for cards, "sm" for ledger rows */
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES = {
  lg: "text-4xl sm:text-5xl font-black leading-none",
  md: "text-2xl font-bold leading-none",
  sm: "text-base font-semibold",
};

export function formatClawd(amount: bigint): string {
  const n = Number(formatUnits(amount, 18));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toFixed(0);
}

/**
 * Displays a CLAWD amount in Playfair Display, blood red.
 * Pot amounts on posters are the one place Playfair + blood is dominant.
 */
export const PotAmount = ({ amount, size = "md", className = "" }: PotAmountProps) => {
  return (
    <span
      className={`font-display text-blood font-variant-numeric-tabular ${SIZE_CLASSES[size]} ${className}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
      aria-label={`${formatClawd(amount)} CLAWD`}
    >
      {formatClawd(amount)}{" "}
      <span className={`font-numeric ${size === "lg" ? "text-xl" : size === "md" ? "text-base" : "text-xs"} opacity-70`}>
        CLAWD
      </span>
    </span>
  );
};

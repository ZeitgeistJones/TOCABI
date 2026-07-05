"use client";

import { useState } from "react";

type TwoStepButtonProps = {
  /** Label for the idle state */
  label: string;
  /** Label for the confirmation state */
  confirmLabel?: string;
  /** Called when the user confirms */
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

/**
 * Two-step confirmation button.
 * First click enters confirm state (and auto-reverts after 4s).
 * Second click calls onConfirm.
 *
 * Used for any irreversible on-chain action:
 * claim, pledge, submit proof, finalize, expire.
 */
export const TwoStepButton = ({
  label,
  confirmLabel,
  onConfirm,
  disabled = false,
  loading = false,
  variant = "primary",
  className = "",
}: TwoStepButtonProps) => {
  const [confirming, setConfirming] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = async () => {
    if (disabled || loading) return;

    if (!confirming) {
      setConfirming(true);
      const t = setTimeout(() => setConfirming(false), 4000);
      setTimer(t);
      return;
    }

    // Second click — confirmed
    if (timer) clearTimeout(timer);
    setConfirming(false);
    await onConfirm();
  };

  const btnClass = `btn btn-${variant} rounded-none font-numeric uppercase tracking-widest ${className}`;
  const displayLabel = confirming ? (confirmLabel ?? `Confirm: ${label}`) : label;

  return (
    <button className={btnClass} onClick={handleClick} disabled={disabled || loading}>
      {loading && <span className="loading loading-spinner loading-sm" />}
      <span className={confirming ? "text-warning" : ""}>{displayLabel}</span>
    </button>
  );
};

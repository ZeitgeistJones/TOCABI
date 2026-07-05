"use client";

import { useEffect, useState } from "react";

type CountdownProps = {
  /** Unix timestamp in seconds (number or bigint) */
  deadline: number | bigint;
  className?: string;
};

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return "Ended";
  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Live countdown timer. Accepts a unix deadline in seconds.
 * Renders in Barlow Condensed with tabular-nums so digits don't jitter.
 */
export const Countdown = ({ deadline, className = "" }: CountdownProps) => {
  const deadlineNum = Number(deadline);

  const [secondsLeft, setSecondsLeft] = useState(() => {
    return Math.max(0, deadlineNum - Math.floor(Date.now() / 1000));
  });

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, deadlineNum - Math.floor(Date.now() / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineNum]);

  const isUrgent = secondsLeft > 0 && secondsLeft < 86400;

  return (
    <span
      className={`font-numeric ${isUrgent ? "text-blood" : "text-ink-soft"} ${className}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
      aria-label={`Time remaining: ${formatCountdown(secondsLeft)}`}
    >
      {secondsLeft === 0 ? (
        <span className="text-faded">Ended</span>
      ) : (
        <>
          <span className="opacity-50 mr-1">⏳</span>
          {formatCountdown(secondsLeft)}
        </>
      )}
    </span>
  );
};

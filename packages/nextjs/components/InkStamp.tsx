"use client";

import { useEffect, useRef } from "react";

type InkStampProps = {
  children: React.ReactNode;
  /** Trigger the animation whenever this key changes */
  animateKey?: string | number;
  className?: string;
};

/**
 * The one animation in the whole app.
 * Wraps confirmation moments (pledge, post, proof, payout) with a
 * scale-from-1.15 + settle + ink-bleed ~350ms stamp animation.
 *
 * Respects prefers-reduced-motion: renders final state instantly.
 */
export const InkStamp = ({ children, animateKey, className = "" }: InkStampProps) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current || animateKey === undefined) return;

    const el = ref.current;
    el.classList.remove("stamp-animate");
    // Force reflow so the animation restarts
    void el.offsetWidth;
    el.classList.add("stamp-animate");

    const onEnd = () => el.classList.remove("stamp-animate");
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
  }, [animateKey]);

  return (
    <span ref={ref} className={`inline-block ${className}`}>
      {children}
    </span>
  );
};

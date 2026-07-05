import { type StampVariant, getStatusEntry } from "~~/utils/statusMap";

type StatusStampProps = {
  status: number;
  /** When true, renders the stamp diagonally (for PAID state on poster) */
  diagonal?: boolean;
  className?: string;
};

const VARIANT_CLASS: Record<StampVariant, string> = {
  ink: "stamp stamp-ink",
  blue: "stamp stamp-blue",
  "gold-outline": "stamp stamp-gold-outline",
  "gold-fill": "stamp stamp-gold-fill",
  faded: "stamp stamp-faded",
};

/**
 * The only way status is displayed anywhere in the app.
 * Uses statusMap.ts — no hardcoded indices elsewhere.
 */
export const StatusStamp = ({ status, diagonal = false, className = "" }: StatusStampProps) => {
  const entry = getStatusEntry(status);
  const variantClass = VARIANT_CLASS[entry.variant];

  if (diagonal) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-label={entry.label}
      >
        <span
          className={`${variantClass} text-base px-4 py-1 ${className}`}
          style={{ transform: "rotate(-12deg)", fontSize: "1.1rem", letterSpacing: "0.15em" }}
        >
          {entry.variant === "gold-fill" ? `DONE — ${entry.label}` : entry.label}
        </span>
      </div>
    );
  }

  return (
    <span className={`${variantClass} ${className}`} aria-label={`Status: ${entry.label}`}>
      {entry.label}
    </span>
  );
};

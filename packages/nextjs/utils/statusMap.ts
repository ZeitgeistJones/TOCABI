/**
 * Single lookup table for the MostClawdWanted contract Status enum.
 * Import this everywhere status is displayed — never hardcode indices elsewhere.
 *
 * Contract enum order (from MostClawdWanted.sol):
 *   0 = Open
 *   1 = Claimed
 *   2 = Submitted
 *   3 = Resolved / Finalized
 *   4 = Expired
 *   5 = Cancelled
 */

export type StatusIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type StampVariant = "ink" | "blue" | "gold-outline" | "gold-fill" | "faded";

type StatusEntry = {
  label: string;
  variant: StampVariant;
  /** True for terminal states where the bounty is no longer active */
  terminal: boolean;
  /** True for states that should render the poster at reduced opacity with torn corner */
  degraded: boolean;
};

export const STATUS_MAP: Record<StatusIndex, StatusEntry> = {
  0: { label: "OPEN", variant: "ink", terminal: false, degraded: false },
  1: { label: "CLAIMED", variant: "blue", terminal: false, degraded: false },
  2: { label: "UNDER REVIEW", variant: "gold-outline", terminal: false, degraded: false },
  3: { label: "PAID", variant: "gold-fill", terminal: true, degraded: false },
  4: { label: "EXPIRED", variant: "faded", terminal: true, degraded: true },
  5: { label: "CANCELLED", variant: "faded", terminal: true, degraded: true },
};

export function getStatusEntry(status: number): StatusEntry {
  if (status in STATUS_MAP) return STATUS_MAP[status as StatusIndex];
  return { label: "UNKNOWN", variant: "faded", terminal: false, degraded: false };
}

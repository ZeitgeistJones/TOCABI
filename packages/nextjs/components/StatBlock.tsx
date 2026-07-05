import { formatClawd } from "~~/components/PotAmount";

type StatBlockProps = {
  label: string;
  value: string | number;
  /** If true, renders in blood red (for CLAWD amounts) */
  highlight?: boolean;
};

/**
 * A single stat block — used in the board hero strip and Rap Sheet.
 */
export const StatBlock = ({ label, value, highlight = false }: StatBlockProps) => (
  <div className="flex flex-col items-center">
    <span
      className={`font-numeric text-2xl sm:text-3xl font-bold leading-none ${highlight ? "text-blood" : "text-ink"}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {value}
    </span>
    <span className="font-numeric text-[0.6rem] uppercase tracking-widest text-ink-soft mt-1">{label}</span>
  </div>
);

type HeroStatsProps = {
  totalPooled: bigint;
  openCount: number;
  builtCount: number;
};

/**
 * The three live hero stats at the top of the board.
 */
export const HeroStats = ({ totalPooled, openCount, builtCount }: HeroStatsProps) => (
  <div className="flex items-center justify-center gap-8 sm:gap-12 py-4 mb-2">
    <StatBlock label="CLAWD pooled" value={`${formatClawd(totalPooled)} CLAWD`} highlight />
    <div className="w-px h-8 bg-ink/20" />
    <StatBlock label="Open" value={openCount} />
    <div className="w-px h-8 bg-ink/20" />
    <StatBlock label="Built" value={builtCount} />
  </div>
);

import BountyDetail from "./BountyDetail";

// For static export we can't enumerate all bounty ids ahead of time.
// Generate a single placeholder route; vercel.json rewrites /bounty/:id → here,
// and the client component reads the real id from the URL pathname.
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export const dynamicParams = false;

export default function Page() {
  return <BountyDetail />;
}

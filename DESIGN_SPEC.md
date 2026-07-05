# TOCABI — Design & Build Spec

**Take Our Clawd And Build It.**
A CLAWD-only crowdfunded bounty board on Base.

This document is the single source of truth for the frontend rebuild. When implementing
in Cursor, reference this file. Where this spec conflicts with existing code, the spec wins.
Where the spec is silent, follow SE-2 conventions (AGENTS.md) and daisyUI patterns.

---

## 0. Decisions (locked)

These are final. Don't relitigate them mid-build.

1. **Name:** TOCABI. Tagline everywhere the wordmark appears: "Take Our Clawd And Build It."
2. **One theme, light only.** The parchment aesthetic *is* the brand. Remove the theme
   switcher (`SwitchTheme.tsx`) and dark theme CSS. A "midnight saloon" dark mode is a
   v2 idea, not a launch feature. This cut removes an entire class of visual QA work.
3. **`/code` page is deleted.** Rules live where decisions happen: a per-bounty
   plain-English summary (the Sentence Generator, §5) plus a compact "House Rules"
   modal linked from the footer. Nobody reads manuals; everybody reads the one
   sentence next to the button they're about to press.
4. **One animation.** The ink-stamp confirmation (§3.6). Nothing else moves except
   standard hover/focus states. If tempted to add motion elsewhere: don't.
5. **Exactly 3 presets on `/create`.** The full option space stays reachable behind
   one accordion. No fourth preset, ever, without deleting one.
6. **Earned titles/badges are Phase 4.** Rap Sheet ships with stats only at first.
7. **Everything is client-side + event-derived.** Static export to IPFS is a hard
   constraint. No API routes, no server components doing data work, no dynamic OG
   images. Share cards are canvas-generated PNGs in the browser (proven pattern).
8. **Mobile-first.** Every page is designed at 390px first, then widened. Most traffic
   arrives from Telegram/Discord/X links on phones.

---

## 1. Vibe

**"Frontier town noticeboard, run by people who like each other."**

Old West wanted-poster DNA, warmed up. Not gritty-outlaw, not costume-party western.
The paper metaphor is executed with restraint: parchment surfaces, ink text, stamps
for state changes. Flavor lives in headings and empty states; body copy and buttons
are always plain English that says exactly what happens.

Voice examples:
- "3 folks pledged" — not "3 addresses contributed"
- "Add to the Pot" — not "Pledge CLAWD"
- "The board's quiet. Post a bounty and stir things up." — empty state
- "Your pledge is on the poster." — pledge success toast
- Buttons name the action's result: "Post Bounty", "Claim This Bounty", "Submit Proof",
  "Approve & Start Challenge Window"

---

## 2. Design Tokens

Extend `globals.css` `@theme` / daisyUI theme. Derive every color decision from this table.

### Color

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#2C1A0E` | Primary text, borders, wordmark |
| `--ink-soft` | `#5C4433` | Secondary text, captions |
| `--paper` | `#F4EAD5` | Page background |
| `--paper-raised` | `#EDE0C4` | Cards, posters |
| `--paper-deep` | `#E2D2AC` | Insets, table stripes, code/ledger rows |
| `--blood` | `#8B1A1A` | Bounty amounts, primary CTAs, the stamp |
| `--blood-hover` | `#6F1414` | CTA hover |
| `--gold` | `#9A7318` | Success/completion ONLY. Paid stamps, earned CLAWD. If gold appears on a screen with no completed thing on it, that's a bug. |
| `--claim-blue` | `#1E3A5F` | "Claimed / in progress" state accents |
| `--faded` | `#B7A88C` | Expired/cancelled content, disabled |

daisyUI mapping: `primary` = blood, `secondary` = claim-blue, `accent` = gold,
`base-100` = paper, `base-200` = paper-raised, `base-300` = paper-deep,
`base-content` = ink, `error` = blood, `success` = gold.

### Type (fonts already loaded in `layout.tsx`)

| Role | Face | Rules |
|---|---|---|
| Display | Playfair Display | Bounty titles, pot amounts, page headings, the DONE stamp. Never for paragraphs or buttons. |
| Body | Libre Baskerville | Descriptions, explanatory copy, the sentence generator output. |
| UI / Utility | Barlow Condensed | Buttons, labels, badges, nav, stats, countdowns, table headers. All-caps with letter-spacing for labels; sentence case for buttons. |

Numbers (pot sizes, countdowns, stats): Barlow Condensed with `font-variant-numeric: tabular-nums`
so countdowns don't jitter. Pot amounts on posters are the one exception — Playfair, huge, blood.

### Surfaces & texture

- Cards: `--paper-raised`, 1px `--ink` border at 25% opacity, 2px border-radius (paper
  is not round), a very subtle drop shadow (paper on corkboard, not floating glass).
- Keep the existing `.parchment` / `.stamp` utilities; retire `.stamp-dark` if unused
  after the status system lands.
- No gradients anywhere. No glassmorphism. No glow.

### Status system (the visual language users learn)

One component, used identically everywhere: `<StatusStamp status={...} />`.
Map from the `Status` enum in `MostClawdWanted.sol` — do not hardcode indices in
multiple places; one lookup table in `utils/`.

| Contract status | Label | Treatment |
|---|---|---|
| Open | `OPEN` | Ink outline stamp on paper |
| Claimed | `CLAIMED` | claim-blue outline stamp |
| Submitted | `UNDER REVIEW` | gold *outline* (not fill — nothing is complete yet) |
| Resolved/Finalized | `PAID` | Gold filled stamp, applied diagonally on posters |
| Expired | `EXPIRED` | faded, poster rendered at 60% opacity with a torn-corner top-right (CSS clip-path) |
| Cancelled | `CANCELLED` | same treatment as Expired, different label |

---

## 3. Pages

Nav (Header): **The Board · Post a Bounty · Rap Sheet** + connect button.
Footer: contract address (existing), "House Rules" modal link, TOCABI wordmark + tagline.

### 3.1 The Board — `/`

Job: answer "what's happening in this town?" in 3 seconds, then route people to a poster.

```
┌──────────────────────────────────────────────┐
│  TOCABI — Take Our Clawd And Build It        │
│  [ 41.2M CLAWD pooled ] [ 6 open ] [ 14 built ]   ← live, from events
├──────────────────────────────────────────────┤
│  🔨 #12 claimed · 💰 4.2M added to #8 · ✅ #5 paid   ← Just Happened ticker
├──────────────────────────────────────────────┤
│  [ Biggest Pot | Ending Soon | Newest | Needs a Builder ]   ← segmented, single-select
├──────────────────────────────────────────────┤
│  ┌─ poster card ─┐ ┌─ poster card ─┐         │
│  │ TITLE (serif) │ │               │          │
│  │ 12.4M CLAWD   │ │  ← amount: Playfair,    │
│  │ [OPEN] ⏳ 3d   │ │     blood, biggest      │
│  └───────────────┘ └───────────────┘          │
└──────────────────────────────────────────────┘
```

- **Card shows exactly 4 things:** title (truncated ~60 chars), pot, StatusStamp,
  time remaining. Nothing else. No mode badges, no pledger counts, no creator address.
- **"Needs a Builder"** filter = status Open AND totalPledged > 0 AND no active claimant.
  This is the builder's job feed; it's the filter that makes builders bookmark the site.
- **Ticker:** last ~8 events across BountyCreated / Pledged / Claimed / Approved /
  Finalized, rendered as one rotating line (CSS animation is fine — it's not the
  signature animation, it's ambient text). Each item links to its poster.
- **Live stats:** computed client-side from the same event history already being fetched.
  Total pooled = sum of active bounty pots; built = count of Finalized.
- Empty state: blank poster illustration + "The board's quiet. Post a bounty and stir
  things up." + Post a Bounty button.
- Loading: 6 skeleton cards styled as blank posters with a faint "printing…" label.

### 3.2 The Poster — `/bounty/[id]`

The most important page. **Role-aware: it computes who you are and shows ONE primary
action.** Keep the existing static-export pattern (placeholder param + read id from
pathname).

Three vertical zones:

**Zone 1 — The Poster (emotional, shareable):**
```
┌──────────── POSTER ────────────┐
│            WANTED              │  ← eyebrow, Barlow caps
│   Build the thing (Playfair)   │
│                                │
│        12,400,000 CLAWD        │  ← Playfair, blood, dominant element
│         [OPEN]  ⏳ 3d 14h       │
│                                │
│  description (Baskerville)…    │
│                                │
│  ▸ How this bounty works       │  ← sentence generator, collapsed
│  [ Share Poster 🖼 ]            │  ← canvas PNG download
└────────────────────────────────┘
```
When status = PAID: gold "DONE — PAID OUT" stamp rendered diagonally across the poster
(the screenshot moment). Expired/Cancelled: faded + torn corner.

**Zone 2 — Your Move (role-aware action card).** Compute role in this priority order;
render exactly one card:

| You are… | Card shows |
|---|---|
| Active claimant | Proof CID input + "Submit Proof" + your personal countdown |
| Judge (or owner in TrustedJudge) w/ submissions pending | Submission list with Approve / Reject per row |
| Pledger during an open vote/veto window | Vote UI + "Your pledge = N% of the vote" |
| Pledger with refundable pledge (per policy/state) | "Take Back Your Pledge" (secondary style) alongside Add to the Pot |
| Anyone, bounty Open, claiming possible | "Claim This Bounty" + one-sentence commitment ("You'll have 3 days to submit proof.") |
| Anyone else, bounty active | "Add to the Pot" — amount input + button |
| Bounty terminal (Paid/Expired/Cancelled) | No action card; show outcome summary instead |

Secondary available actions (e.g. a pledger who could also claim) appear as small
text links *under* the primary card, never as competing buttons.

**Approve+pledge must read as one action.** Keep the two-state protection already in
`BountyDetail.tsx`, but present it as a single button whose label advances:
"Unlock CLAWD (1/2)" → "Add to the Pot (2/2)", with a thin progress bar between states.

**Zone 3 — The Ledger.** Chronological per-bounty event timeline (pledges, claims,
proofs, votes, approvals), newest first, collapsed after 5 rows ("Show full ledger").
Rows on `--paper-deep`, addresses via `<Address />`, amounts in Barlow.

**Share Poster:** canvas-rendered PNG (title, pot, status stamp, TOCABI wordmark,
URL) with a download button. Same technique as the Talk Normie 2 Me share cards.
This is the marketing loop — people posting bounties will do the distribution for you.

### 3.3 Post a Bounty — `/create`

Three steps, one screen each, progress dots at top. Presets are outcome-named cards:

**Step 1 — The Ask:** title, description, deadline, initial pot (optional, can pledge after).

**Step 2 — How It Gets Decided:** three preset cards (radio behavior):

| Preset | Copy on card | Maps to |
|---|---|---|
| 🤝 **Trust a Judge** | "You, or someone you name, decides who did the work." | TrustedJudge, FCFS, hybrid refund, 7d challenge |
| ⚡ **First to Deliver** | "Fastest builder wins. The community can challenge." | FCFS + challenge window, anytime refund |
| 🗳️ **Community Decides** | "Pledgers vote on the best submission." | PledgerVote, open claims, unlock-time refund |

*(Map preset → exact enum values from the contract at implementation time; the three
existing presets in `create/page.tsx` are the starting point — rename and re-copy them,
verify the parameter bundles against the audit findings.)*

Below the cards, one quiet accordion: **"Customize the fine print"** — opens every
knob (splits, windows, veto thresholds, refund policy). Inside it, a live donut/bar
showing where 1,000,000 CLAWD would go as splits change. Most users never open this;
the ones who do feel like they found the cheat codes.

**Step 3 — Read It Back:** the sentence generator renders the full plain-English
summary of what they configured + the poster preview. One button: "Post Bounty."
This step is the error-prevention layer — people catch their own mistakes when the
config is read back to them as a sentence.

### 3.4 Rap Sheet — `/rap-sheet` and `/rap-sheet/[address]`

Identity page, viewable for any address (same static-export pattern as posters).
Own address = default when connected.

- Header: `<Address />` big, then four stamped stat blocks in a row:
  **Funded · Built · CLAWD Pledged · CLAWD Earned** (all event-derived).
- Below: two tabs — "Pledges" and "Builds" — each a simple ledger-style table
  linking to posters.
- Phase 4 adds earned titles here (Deputy / Bounty Hunter / The Bank / Sheriff).
- Public profiles are the community-flex loop: people link their rap sheet in chat.

### 3.5 House Rules (modal, not a page)

Footer link opens a daisyUI modal: ~10 short bullets covering the universal rules
(what pledging means, challenge windows, refund basics, splits bounds, "code is law,
read the poster's own summary"). Link to BaseScan contract. Delete `/code`.

### 3.6 The Signature Animation — the Stamp

One reusable component: `<InkStamp />`. On these confirmations only —
pledge confirmed, bounty posted, proof submitted, payout finalized —
the relevant stamp/amount lands with a quick scale-from-1.15-to-1 + slight
rotation settle + one-frame ink-bleed (box-shadow pulse), ~350ms, `cubic-bezier(.2,.9,.3,1.3)`.
Respect `prefers-reduced-motion` (render final state instantly). That's the entire
motion budget of the app.

---

## 4. Transaction & feedback copy

Upgrade `notification` usage. Every success toast says what changed in the world,
in-theme, ≤ 8 words:

| Event | Toast |
|---|---|
| Pledge confirmed | "Your pledge is on the poster." |
| Bounty created | "Poster's up. Spread the word." |
| Claim confirmed | "It's yours. Clock's ticking — Nd left." |
| Proof submitted | "Proof's in. Awaiting judgment." |
| Approve confirmed | "Approved. Challenge window open." |
| Finalize confirmed | "Paid out. Another one built." |
| Refund confirmed | "Your CLAWD is back in your pocket." |
| Error (parsed) | Plain-English error via `getParsedErrorWithAllAbis`, no flavor text on errors — errors are never cute. |

Countdowns: always live timers (`3d 14h 22m`), never raw timestamps, everywhere a
window matters (bounty deadline, claim window, challenge window, veto window).

---

## 5. The Sentence Generator (core component)

`utils/bountySentence.ts` — pure function `(bounty) => string[]` producing 3–5 short
sentences from the bounty's actual on-chain config. Used in three places:
poster "How this bounty works", create Step 3 read-back, and the share card's fine print.

Composition rules (one sentence per clause, plain English, present tense):

1. **Claim clause** from `claimMode`:
   - FCFS → "First person to claim it gets {claimWindow, humanized} to deliver."
   - OpenJudgePicks → "Anyone can submit work; the judge picks the best."
   - OpenFirstValid → "Anyone can submit work; first valid submission wins."
2. **Decision clause** from `resolutionMode` (+ judge fields):
   - TrustedJudge → "{judge short-addr / 'The bounty owner'} decides who did the work."
   - PledgerVote → "Pledgers vote; a submission needs {pledgerOverrideBps/100}% of the pot's weight to win."
   - JudgeWithOverride → "The judge picks a winner, but pledgers holding {bps}% of the pot can override."
   - Open judge slot → prepend "A judge can step forward; pledgers have {vetoWindow} to veto them."
3. **Challenge clause:** "After approval there's a {challengeWindow, humanized} challenge period before payout."
4. **Split clause:** "Payout: {claimant}% builder · {treasury}% treasury · {burn}% burned."
5. **Refund clause** from `refundPolicy`:
   - Anytime → "Pledgers can pull back their CLAWD any time before a claim."
   - AfterUnlock → "Pledges lock until {date}."
   - Hybrid → "Pledges lock until {date}, and stay locked while work is in progress."

Humanize windows via the contract's allowed values (1/3/7 days → "24 hours" / "3 days" / "7 days").
Map enum indices from `MostClawdWanted.sol` in ONE place; never duplicate the mapping.

---

## 6. Component inventory (build once, use everywhere)

| Component | Notes |
|---|---|
| `PosterCard` | Board card: title, pot, StatusStamp, countdown |
| `StatusStamp` | §2 status table; the only way status is ever displayed |
| `PotAmount` | Playfair + blood + CLAWD formatting (existing `formatClawd`) |
| `Countdown` | live ticking, tabular nums, accepts a unix deadline |
| `ActionCard` | Zone 2 shell; children per role |
| `TwoStepButton` | approve→pledge single-button flow |
| `LedgerTimeline` | per-bounty and rap-sheet event tables |
| `InkStamp` | the one animation |
| `BountySentence` | renders `bountySentence()` output |
| `SharePosterButton` | canvas → PNG download |
| `Ticker` | board "Just Happened" line |
| `StatBlock` | hero stats + rap sheet stats |
| `HouseRulesModal` | footer modal |

All daisyUI-based, SE-2 hooks only (`useScaffoldReadContract` / `useScaffoldEventHistory` /
`useScaffoldWriteContract`), `@scaffold-ui/components` for Address/AddressInput/etc.
Note: `useScaffoldEventHistory` on Base mainnet is RPC-heavy — keep the existing
`blocksBatchSize` discipline and set `fromBlock` to the deploy block everywhere; if the
board ever feels slow, that's the first knob (a Ponder indexer is the v2 answer, not now).

---

## 7. Build order

Ship in this order. Each phase is independently deployable — the app never breaks
mid-rebrand.

**Phase 1 — Identity & Tokens** *(smallest, do first)*
- Rebrand: TOCABI wordmark + tagline in Header/Footer/metadata (`getMetadata`),
  favicon update, delete SwitchTheme + dark theme, apply §2 tokens to `globals.css`.
- Build `StatusStamp`, `PotAmount`, `Countdown`, `InkStamp`.
- Delete `/code`, add `HouseRulesModal` to Footer.

**Phase 2 — The Board**
- `PosterCard`, segmented filter (incl. Needs a Builder), hero stats, `Ticker`,
  empty/loading states.

**Phase 3 — The Poster**
- `bountySentence.ts` + `BountySentence`.
- Restructure `/bounty/[id]` into the three zones; role computation + `ActionCard`
  variants; `TwoStepButton`; `LedgerTimeline`; terminal-state poster treatments
  (DONE stamp, torn corner).
- Upgrade all toast copy (§4).

**Phase 4 — Create wizard + Rap Sheet + share**
- 3-step create flow with presets, fine-print accordion + live split donut, read-back step.
- Rap Sheet stats + public `/rap-sheet/[address]`.
- `SharePosterButton` canvas cards.
- Earned titles (Deputy etc.) last, only if everything above is solid.

**Definition of done, every phase:** works at 390px width, keyboard focus visible,
`prefers-reduced-motion` respected, `yarn next:lint` and `check-types` clean,
static export builds (`yarn build`), Grumpy Carlos review passes.

---

## 8. What was deliberately cut (so it doesn't creep back in)

- Dark mode / theme switcher → v2
- `/code` page → replaced by sentence generator + modal
- Earned titles at launch → Phase 4 tail
- Ambient animations, gradients, glass effects → never
- Pot progress bars → bounties have no funding goal; a progress bar would lie
- Dynamic OG images → impossible on static IPFS export; canvas share cards instead
- Any 4th create preset → requires deleting one first
- Subgraph/indexer → v2, only if event-fetching performance actually hurts

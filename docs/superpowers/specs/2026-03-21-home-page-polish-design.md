# Home Page Polish — Design Spec

## Goal

Make the home page look impressive for hackathon judges by adding branding, a stats summary, and refined prediction cards.

## Changes

### 1. Header & Brand

**File:** `frontend/components/HomeClient.tsx`

- Replace "Prediction Market" h1 with **"Longtail"** using a purple-to-blue gradient on the text (`inline-block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent`)
- Add subtitle below: "Agent-powered P2P predictions on Base" in `text-gray-500 text-sm`
- Connect Wallet + New Prediction buttons stay right-aligned
- Update page title in `frontend/app/layout.tsx` metadata to "Longtail"

### 2. Stats Bar

**File:** `frontend/components/HomeClient.tsx`

Three inline stat cards between header and filters:

| Stat | Label | Value |
|------|-------|-------|
| Total Markets | "Markets" | `predictions.length` |
| Total Staked | "Total Staked" | Sum of `stakeAmount * 2` for Funded/Resolving/JuryResolving/Settled, `stakeAmount` for Created. Formatted as "X USDC" |
| Active Now | "Active" | Count of predictions where state is Funded, Resolving, or JuryResolving |

Layout: `flex gap-4` container, each card `flex-1`. Style per card: `bg-navy-800 border border-navy-700 rounded-lg px-4 py-3`. Label in `text-xs text-gray-500 uppercase`, value in `text-lg font-bold text-white`.

`stakeAmount` is a string — parse with `parseFloat()` for summation. Display with up to 2 decimal places. No abbreviation needed (hackathon amounts are small).

All computed client-side from the `predictions` array — no new API calls or data fetching.

### 3. Card Refinements

**File:** `frontend/components/TimelineItem.tsx`

- Replace the plain-text `{stakeAmount} USDC` span in the metadata row with a styled badge using `ml-auto` to push it right
  - Created state: show "Stake: X USDC"
  - Funded/Resolving/JuryResolving/Settled: show "Pool: X×2 USDC" (state enum guarantees both deposits)
  - Style: `bg-navy-900 border border-navy-700 rounded-full px-2 py-0.5 text-xs text-gray-300 ml-auto`

### 4. Filter Updates

**File:** `frontend/components/HomeClient.tsx`

- Add `'JuryResolving'` to the `FILTERS` array
- Show count next to each filter label: e.g., "Funded (3)"
  - Count computed from `predictions` array (unfiltered)
  - For "All", show total count

## Files Modified

| File | Change |
|------|--------|
| `frontend/components/HomeClient.tsx` | Header brand, stats bar, filter counts + JuryResolving |
| `frontend/components/TimelineItem.tsx` | Stake/pool badge |
| `frontend/app/layout.tsx` | Update metadata title |

## Verification

1. `cd frontend && npx tsc --noEmit` — types pass
2. `cd frontend && npm run build` — production build succeeds
3. Visual check: home page shows Longtail branding, stats bar, refined cards, filter counts

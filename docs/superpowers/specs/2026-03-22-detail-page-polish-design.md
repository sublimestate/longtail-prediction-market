# Detail Page Polish — Design Spec

## Goal

Make the prediction detail page visually impressive with a hero card, outcome callout banners, and slimmed-down escrow details.

## Changes

### 1. Hero Card

**File:** `frontend/app/prediction/[address]/page.tsx`

Replace the current title/status/stepper markup with a hero card:

- Card style: `bg-navy-800 border-l-4 border-gradient` (purple-to-blue left border via a wrapper div with gradient background)
- Back link: change "← Back" to "← Longtail" to reinforce branding
- Prediction title: bump to `text-2xl font-bold`
- Badges row: StatusBadge + resolution method badge side by side
  - Resolution method badge: "LLM Jury" (yellow) if `challengeWindow > 0` or state is JuryResolving, "UMA Oracle" (amber/orange) otherwise
  - Style: same pill format as StatusBadge
- Key stats row inside the hero card (3 items, `grid grid-cols-3`):
  - **Pool**: `stakeAmount * 2` USDC if Funded+, `stakeAmount` USDC if Created (with "per side" label)
  - **Deadline**: formatted date+time (existing `toLocaleString` format)
  - **Resolution Window**: existing `CountdownTimer` component
- PipelineStepper at the bottom of the hero card

### 2. Outcome Callout Banners

**File:** `frontend/app/prediction/[address]/page.tsx`

Inserted between hero card and the action sections:

- **Settled state**: green-tinted banner (`bg-green-500/10 border border-green-500/30`)
  - Text: "{YES/NO} wins — {stakeAmount * 2} USDC paid to {truncateAddress(winner)}"
  - Bold outcome, green for YES, red for NO
- **JuryResolving state**: yellow-tinted banner (`bg-yellow-500/10 border border-yellow-500/30`)
  - Text: "Jury proposed: {YES/NO} — challenge window closes in {CountdownTimer}"
- Other states: no banner

### 3. Slim Escrow Details

**File:** `frontend/app/prediction/[address]/page.tsx`

Remove from the Escrow Details grid:
- Stake (moved to hero card pool stat)
- Deadline (moved to hero card)
- Resolution Window (moved to hero card)

Keep:
- Contract (with BaseScan link)
- Party YES
- Party NO (with "Open — anyone can match" for zero address)

Change grid from `grid-cols-2 gap-3` to `grid-cols-3 gap-3` for the 3 remaining items.

## Files Modified

| File | Change |
|------|--------|
| `frontend/app/prediction/[address]/page.tsx` | Hero card, callout banners, slim escrow details |

## Verification

1. `cd frontend && npx tsc --noEmit` — types pass
2. `cd frontend && npm run build` — production build succeeds
3. Visual check: detail page shows hero card with gradient border, callout banners for settled/jury states, compact escrow details

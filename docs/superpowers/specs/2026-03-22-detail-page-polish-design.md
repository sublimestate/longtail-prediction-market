# Detail Page Polish — Design Spec

## Goal

Make the prediction detail page visually impressive with a hero card, outcome callout banners, and slimmed-down escrow details.

## Changes

### 1. Hero Card

**File:** `frontend/app/prediction/[address]/page.tsx`

Replace the current title/status/stepper markup with a hero card:

- Card style: outer div with `bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-[2px]`, inner div with `bg-navy-800 rounded-lg p-5` — creates a gradient border effect
- Back link: change all "← Back" to "← Longtail" (3 instances: lines 32, 46, 56)
- Prediction title: bump to `text-2xl font-bold`
- Badges row: StatusBadge + resolution method badge side by side
  - Resolution method badge: "LLM Jury" (yellow pill) when state is `JuryResolving`, "UMA Oracle" (amber pill) when state is `Resolving`. No resolution badge for other states (Created, Funded, Settled, Expired) — resolution path isn't determined/relevant yet/anymore
  - Style: same pill format as StatusBadge (`px-2 py-0.5 rounded-full text-xs font-medium`)
- Key stats row inside the hero card (3 items, `grid grid-cols-3 gap-4`):
  - **Pool**: `${parseFloat(stakeAmount) * 2} USDC` if state is Funded/Resolving/JuryResolving/Settled (both deposits made), `${stakeAmount} USDC per side` if Created
  - **Deadline**: formatted with `toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })`
  - **Resolution Window**: existing `CountdownTimer` component with `targetTimestamp={deadline}`
- PipelineStepper at the bottom of the hero card
- Each stat: label in `text-xs text-gray-500`, value in `text-sm text-white`

### 2. Outcome Callout Banners

**File:** `frontend/app/prediction/[address]/page.tsx`

Inserted between hero card and the action sections:

- **Settled state**: green-tinted banner (`bg-green-500/10 border border-green-500/30 rounded-lg p-4`)
  - Winner computed as: `resolvedYes ? partyYes : partyNo`, displayed via `truncateAddress(winner)`
  - Text: "{YES/NO} wins — {parseFloat(stakeAmount) * 2} USDC paid to {truncateAddress(winner)}"
  - Outcome word styled green for YES (`text-green-400`), red for NO (`text-red-400`)
- **JuryResolving state**: yellow-tinted banner (`bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4`)
  - Text: "Jury proposed: {YES/NO} — challenge window closes in `<CountdownTimer targetTimestamp={juryDeadline} />`"
- Other states: no banner

### 3. Slim Escrow Details

**File:** `frontend/app/prediction/[address]/page.tsx`

Remove from the Escrow Details grid:
- Stake row (moved to hero card pool stat)
- Deadline row (moved to hero card)
- Resolution Window row (moved to hero card)

Keep in order:
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

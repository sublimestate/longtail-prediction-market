# Frontend Dashboard Design

## Overview

Next.js app in `frontend/` workspace. Two pages: timeline feed dashboard and prediction detail page. Reads on-chain escrow data + OpenServ agent metadata via server-side API routes.

## Pages

### Home (`/`)

- Header: project title + "New Prediction" button
- Status filter tabs: All | Created | Funded | Resolving | Settled
- Timeline feed: vertical list with colored status dots, each item shows description, status badge, stake amount, deadline or countdown timer, one-line summary
- Auto-refresh every 30s
- "New Prediction" opens a modal form

### Detail (`/prediction/[address]`)

- **Pipeline stepper**: Created → Funded → Resolving → Settled, current step highlighted. Steps map directly to on-chain `EscrowState`. No "Matched" step — matching happens off-chain before the escrow exists.
- **Escrow info**: parties (truncated addresses), stake amount, deadline, contract address linked to Basescan
- **Jury section** (visible when resolved/settled): 3 vote cards showing role (derived from agentId: 1=skeptic, 2=optimist, 3=arbiter), YES/NO vote, reasoning text
- **UMA section** (visible when resolving): assertionId, countdown timer for 2hr dispute window, link to UMA explorer
- **Settlement section** (visible when settled): outcome (YES/NO), winner address, settlement tx hash linked to Basescan

### New Prediction Modal

- Fields: prediction text (textarea), stake amount in USDC (number input), deadline (date picker)
- Submits to `/api/predict`
- Shows confirmation with link to track the prediction

## API Routes

### `GET /api/predictions`

1. Read `EscrowFactory.getEscrowCount()` on Base Sepolia
2. Enumerate all escrows via `getEscrow(i)`
3. Read `getEscrowState()` for each
4. Fetch agent metadata from OpenServ API (workspace tasks) for jury votes, prediction specs, pipeline progress
5. Merge and return unified JSON array

Response shape:
```typescript
{
  predictions: {
    escrowAddress: string;
    description: string;
    state: 'Created' | 'Funded' | 'Resolving' | 'Settled' | 'Expired';
    stakeAmount: string; // human-readable USDC
    deadline: number; // unix timestamp
    partyYes: string;
    partyNo: string;
    assertionId: string;
    resolvedYes: boolean;
    // Agent metadata (null if not available from OpenServ)
    juryVotes?: { agentId: number; role: 'skeptic' | 'optimist' | 'arbiter'; vote: boolean; reasoning: string }[];
    resolutionCriteria?: string;
  }[];
}

// Error response (all routes):
{ error: string }
```

Agent metadata failures are non-fatal — return predictions with null agent fields rather than failing the request.

### `GET /api/predictions/[address]`

Same as above but for a single escrow. Includes full jury reasoning and pipeline task history.

### `POST /api/predict`

Proxies to OpenServ webhook. Request body:
```typescript
{
  prediction: string;
  stakeAmount?: string; // default "1"
  deadline?: string; // ISO date, default 1 week from now
}
```

Forwards to `https://api.openserv.ai/webhooks/trigger/{WEBHOOK_TOKEN}` server-side. Returns `{ success: boolean, message: string }`.

## Data Sources

### On-chain (via viem, server-side)

- **RPC**: Base Sepolia (`https://sepolia.base.org`)
- **Factory**: `EscrowFactory` at `FACTORY_ADDRESS` env var
- **Per-escrow reads**: state, partyYes, partyNo, stakeAmount, deadline, description, assertionId, resolvedYes
- Uses same ABIs from `agents/src/shared/blockchain.ts` (duplicated into frontend, not imported — separate workspace)

### OpenServ API (server-side)

- Agent metadata: jury votes, reasoning, prediction specs
- Pipeline task status and history
- Accessed via OpenServ Client SDK or direct API calls
- Cached with 30s TTL to avoid rate limits

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS, dark theme
- **On-chain reads**: viem (server-side in API routes only)
- **No wallet connection**: read-only dashboard + webhook submission
- **Workspace**: `frontend/` directory, added to root `package.json` workspaces array

## Environment Variables

Required in `frontend/.env.local`:
- `FACTORY_ADDRESS` — EscrowFactory contract address on Base Sepolia
- `BASE_SEPOLIA_RPC_URL` — RPC endpoint (default: `https://sepolia.base.org`)
- `WEBHOOK_TOKEN` — OpenServ webhook trigger token (for `/api/predict` proxy)
- `OPENSERV_API_KEY` — for fetching agent metadata (if using Client SDK)

## Visual Design

- Dark theme: deep navy/charcoal backgrounds (`#1a1a2e`, `#16213e`)
- Status colors: Created (blue `#60a5fa`), Funded (purple `#a78bfa`), Resolving (amber `#fbbf24`), Settled (green `#4ade80`), Expired (gray `#6b7280`)
- Timeline: left border with colored dots per status
- Monospace accents for addresses and hashes
- Responsive: works on desktop and mobile

## File Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout, dark theme, fonts
│   ├── page.tsx            # Home — timeline feed + filters
│   ├── prediction/
│   │   └── [address]/
│   │       └── page.tsx    # Detail page
│   └── api/
│       ├── predictions/
│       │   ├── route.ts    # GET all predictions
│       │   └── [address]/
│       │       └── route.ts # GET single prediction
│       └── predict/
│           └── route.ts    # POST new prediction
├── components/
│   ├── Timeline.tsx        # Timeline feed component
│   ├── TimelineItem.tsx    # Single prediction in feed
│   ├── StatusBadge.tsx     # Colored status pill
│   ├── PipelineStepper.tsx # Step progress indicator
│   ├── JuryCard.tsx        # Jury vote display
│   ├── NewPredictionModal.tsx # Submission form
│   └── CountdownTimer.tsx  # Deadline/UMA timer
├── lib/
│   ├── contracts.ts        # viem client + ABI + read helpers
│   ├── openserv.ts         # OpenServ API client
│   └── types.ts            # Shared types
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

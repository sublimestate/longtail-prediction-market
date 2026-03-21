# Frontend Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js dashboard that displays prediction escrow state from Base Sepolia and lets users submit new predictions via webhook proxy.

**Architecture:** Next.js 14 App Router with server-side API routes that read on-chain data via viem and agent metadata via OpenServ API. Dark-themed timeline feed UI with Tailwind CSS. No wallet connection — read-only + webhook submission.

**Tech Stack:** Next.js 14, Tailwind CSS, viem, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-21-frontend-dashboard-design.md`

---

## Chunk 1: Project Scaffold + Shared Library

### Task 1: Scaffold Next.js project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.js`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/app/layout.tsx`
- Create: `frontend/app/page.tsx`
- Create: `frontend/.env.local`
- Modify: `package.json` (root)

- [ ] **Step 1: Create Next.js app**

```bash
cd /Users/arsen/dev_env/longtail-prediction-market
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-turbopack
```

Accept defaults. This creates the full scaffold with Tailwind already configured.

- [ ] **Step 2: Add viem dependency**

```bash
cd frontend && npm install viem
```

- [ ] **Step 3: Add `frontend` to root workspaces**

Modify root `package.json`:
```json
{
  "name": "longtail-prediction-market",
  "private": true,
  "workspaces": [
    "contracts",
    "agents",
    "frontend"
  ]
}
```

- [ ] **Step 4: Create `.env.local`**

Create `frontend/.env.local`:
```
FACTORY_ADDRESS=0x835a91497987D21F8Cb92336190BC99Cc90908F7
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
WEBHOOK_TOKEN=
OPENSERV_API_KEY=
```

- [ ] **Step 5: Configure dark theme in layout**

Replace `frontend/app/layout.tsx` with root layout that sets dark background, Inter font, and base metadata:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Prediction Market',
  description: 'Agent-powered P2P prediction market on Base',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#1a1a2e] text-gray-200 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Set up Tailwind dark theme colors**

Open `frontend/tailwind.config.ts`. Inside the `theme.extend` object (created by `create-next-app`), add a `colors` key. The file will look like:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#1a1a2e', 800: '#16213e', 700: '#1e1e3a' },
        status: {
          created: '#60a5fa',
          funded: '#a78bfa',
          resolving: '#fbbf24',
          settled: '#4ade80',
          expired: '#6b7280',
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 7: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` — should show dark page. Kill the dev server after verifying.

- [ ] **Step 8: Commit**

```bash
git add frontend/ package.json
git commit -m "scaffold: Next.js frontend with Tailwind dark theme"
```

### Task 2: Shared types and contract library

**Files:**
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/contracts.ts`

- [ ] **Step 1: Create shared types**

Create `frontend/lib/types.ts`:
```typescript
export type EscrowState = 'Created' | 'Funded' | 'Resolving' | 'Settled' | 'Expired';

export interface JuryVote {
  agentId: number;
  role: 'skeptic' | 'optimist' | 'arbiter';
  vote: boolean;
  reasoning: string;
}

export interface Prediction {
  escrowAddress: string;
  description: string;
  state: EscrowState;
  stakeAmount: string;
  deadline: number;
  partyYes: string;
  partyNo: string;
  assertionId: string;
  resolvedYes: boolean;
  juryVotes?: JuryVote[];
  resolutionCriteria?: string;
}
```

- [ ] **Step 2: Create contract read helpers**

Create `frontend/lib/contracts.ts`. Duplicates ABIs from `agents/src/shared/blockchain.ts` (separate workspace, cannot import). Exports `getEscrowCount()`, `getEscrowAddress(index)`, `getEscrowState(address)`, and `getAllPredictions()`:

```typescript
import { createPublicClient, http, parseAbi, formatUnits, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { Prediction, EscrowState } from './types';

const ESCROW_STATE_MAP: Record<number, EscrowState> = {
  0: 'Created',
  1: 'Funded',
  2: 'Resolving',
  3: 'Settled',
  4: 'Expired',
};

const escrowFactoryAbi = parseAbi([
  'function getEscrowCount() external view returns (uint256)',
  'function getEscrow(uint256 index) external view returns (address)',
]);

const predictionEscrowAbi = parseAbi([
  'function state() external view returns (uint8)',
  'function partyYes() external view returns (address)',
  'function partyNo() external view returns (address)',
  'function stakeAmount() external view returns (uint256)',
  'function deadline() external view returns (uint256)',
  'function description() external view returns (string)',
  'function assertionId() external view returns (bytes32)',
  'function resolvedYes() external view returns (bool)',
]);

function getClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
  });
}

function getFactoryAddress(): Address {
  const addr = process.env.FACTORY_ADDRESS;
  if (!addr) throw new Error('FACTORY_ADDRESS not set');
  return addr as Address;
}

export async function getEscrowState(escrowAddress: Address): Promise<Prediction> {
  const client = getClient();
  const [state, partyYes, partyNo, stakeAmount, deadline, description, assertionId, resolvedYes] =
    await Promise.all([
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'state' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyYes' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyNo' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'stakeAmount' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'deadline' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'description' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'assertionId' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'resolvedYes' }),
    ]);

  return {
    escrowAddress,
    description: description as string,
    state: ESCROW_STATE_MAP[state as number] || 'Created',
    stakeAmount: formatUnits(stakeAmount as bigint, 6),
    deadline: Number(deadline),
    partyYes: partyYes as string,
    partyNo: partyNo as string,
    assertionId: assertionId as string,
    resolvedYes: resolvedYes as boolean,
  };
}

export async function getAllPredictions(): Promise<Prediction[]> {
  const client = getClient();
  const factory = getFactoryAddress();

  const count = await client.readContract({
    address: factory,
    abi: escrowFactoryAbi,
    functionName: 'getEscrowCount',
  });

  const n = Number(count);
  if (n === 0) return [];

  const addresses = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      client.readContract({
        address: factory,
        abi: escrowFactoryAbi,
        functionName: 'getEscrow',
        args: [BigInt(i)],
      })
    )
  );

  const predictions = await Promise.all(
    addresses.map((addr) => getEscrowState(addr as Address))
  );

  return predictions;
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/
git commit -m "feat: add shared types and on-chain contract read helpers"
```

### Task 2b: OpenServ API client

**Files:**
- Create: `frontend/lib/openserv.ts`

- [ ] **Step 1: Install OpenServ Client SDK**

```bash
cd frontend && npm install @openserv-labs/client
```

- [ ] **Step 2: Create OpenServ client with caching**

Create `frontend/lib/openserv.ts`:
```typescript
import type { JuryVote } from './types';

const ROLE_MAP: Record<number, JuryVote['role']> = {
  1: 'skeptic',
  2: 'optimist',
  3: 'arbiter',
};

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 30_000; // 30s

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

export interface AgentMetadata {
  juryVotes?: JuryVote[];
  resolutionCriteria?: string;
}

export async function getAgentMetadata(escrowAddress: string): Promise<AgentMetadata | null> {
  const cacheKey = `metadata:${escrowAddress}`;
  const cached = getCached<AgentMetadata>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.OPENSERV_API_KEY;
  if (!apiKey) return null;

  try {
    // Query OpenServ workspace tasks for this escrow address
    const resp = await fetch('https://api.openserv.ai/workspaces/tasks/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: escrowAddress }),
    });

    if (!resp.ok) return null;

    const tasks = await resp.json();
    const metadata: AgentMetadata = {};

    // Extract jury votes from resolution task output
    for (const task of Array.isArray(tasks) ? tasks : []) {
      const output = task.output || task.result || '';
      if (typeof output !== 'string') continue;

      // Look for jury vote JSON in task output
      const jsonMatch = output.match(/```json\s*([\s\S]*?)```/) || output.match(/\{[\s\S]*"votes"[\s\S]*\}/);
      if (!jsonMatch) continue;

      try {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        if (parsed.votes && Array.isArray(parsed.votes)) {
          metadata.juryVotes = parsed.votes.map((v: any) => ({
            agentId: v.agent || v.agentId,
            role: ROLE_MAP[v.agent || v.agentId] || 'arbiter',
            vote: v.vote === 'YES' || v.vote === true,
            reasoning: v.reasoning || '',
          }));
        }
        if (parsed.claim) {
          metadata.resolutionCriteria = parsed.claim;
        }
      } catch {
        continue;
      }
    }

    setCache(cacheKey, metadata);
    return metadata;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/openserv.ts frontend/package.json
git commit -m "feat: add OpenServ API client with 30s cache for agent metadata"
```

---

## Chunk 2: API Routes

### Task 3: GET /api/predictions

**Files:**
- Create: `frontend/app/api/predictions/route.ts`

- [ ] **Step 1: Create predictions API route**

Create `frontend/app/api/predictions/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getAllPredictions } from '@/lib/contracts';
import { getAgentMetadata } from '@/lib/openserv';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const predictions = await getAllPredictions();

    // Enrich with agent metadata (non-fatal — null fields if unavailable)
    const enriched = await Promise.all(
      predictions.map(async (p) => {
        const meta = await getAgentMetadata(p.escrowAddress);
        return { ...p, ...meta };
      })
    );

    return NextResponse.json({ predictions: enriched });
  } catch (e: any) {
    console.error('Failed to fetch predictions:', e);
    return NextResponse.json({ error: e.message || 'Failed to fetch predictions' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify route responds**

```bash
cd frontend && npm run dev &
sleep 3
curl -s http://localhost:3000/api/predictions | head -c 200
kill %1
```

Expected: JSON response with `predictions` array (may be empty or populated depending on factory state).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/predictions/route.ts
git commit -m "feat: add GET /api/predictions route"
```

### Task 4: GET /api/predictions/[address]

**Files:**
- Create: `frontend/app/api/predictions/[address]/route.ts`

- [ ] **Step 1: Create single prediction API route**

Create `frontend/app/api/predictions/[address]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getEscrowState } from '@/lib/contracts';
import { getAgentMetadata } from '@/lib/openserv';
import type { Address } from 'viem';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }
    const prediction = await getEscrowState(address as Address);
    const meta = await getAgentMetadata(address);
    return NextResponse.json({ ...prediction, ...meta });
  } catch (e: any) {
    console.error('Failed to fetch prediction:', e);
    return NextResponse.json({ error: e.message || 'Failed to fetch prediction' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/api/predictions/\[address\]/route.ts
git commit -m "feat: add GET /api/predictions/[address] route"
```

### Task 5: POST /api/predict

**Files:**
- Create: `frontend/app/api/predict/route.ts`

- [ ] **Step 1: Create prediction submission proxy route**

Create `frontend/app/api/predict/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prediction, stakeAmount, deadline } = body;

    if (!prediction || typeof prediction !== 'string') {
      return NextResponse.json({ error: 'prediction is required' }, { status: 400 });
    }

    const webhookToken = process.env.WEBHOOK_TOKEN;
    if (!webhookToken) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const resp = await fetch(`https://api.openserv.ai/webhooks/trigger/${webhookToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prediction,
        stakeAmount: stakeAmount || '1',
        deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `Webhook failed: ${text}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Prediction submitted to pipeline' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to submit prediction' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/api/predict/route.ts
git commit -m "feat: add POST /api/predict webhook proxy route"
```

---

## Chunk 3: UI Components

### Task 6: StatusBadge and CountdownTimer components

**Files:**
- Create: `frontend/components/StatusBadge.tsx`
- Create: `frontend/components/CountdownTimer.tsx`

- [ ] **Step 1: Create StatusBadge**

Create `frontend/components/StatusBadge.tsx`:
```tsx
import type { EscrowState } from '@/lib/types';

const STATUS_STYLES: Record<EscrowState, string> = {
  Created: 'bg-status-created/20 text-status-created',
  Funded: 'bg-status-funded/20 text-status-funded',
  Resolving: 'bg-status-resolving/20 text-status-resolving',
  Settled: 'bg-status-settled/20 text-status-settled',
  Expired: 'bg-status-expired/20 text-status-expired',
};

export function StatusBadge({ state }: { state: EscrowState }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[state]}`}>
      {state.toUpperCase()}
    </span>
  );
}
```

- [ ] **Step 2: Create CountdownTimer**

Create `frontend/components/CountdownTimer.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';

export function CountdownTimer({ targetTimestamp }: { targetTimestamp: number }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = targetTimestamp - Math.floor(Date.now() / 1000);
      if (diff <= 0) {
        setRemaining('Expired');
        return;
      }
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      if (days > 0) setRemaining(`${days}d ${hours}h`);
      else if (hours > 0) setRemaining(`${hours}h ${mins}m`);
      else setRemaining(`${mins}m`);
    }
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return <span className="text-gray-400 text-sm">{remaining}</span>;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/StatusBadge.tsx frontend/components/CountdownTimer.tsx
git commit -m "feat: add StatusBadge and CountdownTimer components"
```

### Task 7: TimelineItem and Timeline components

**Files:**
- Create: `frontend/components/TimelineItem.tsx`
- Create: `frontend/components/Timeline.tsx`

- [ ] **Step 1: Create TimelineItem**

Create `frontend/components/TimelineItem.tsx`:
```tsx
import Link from 'next/link';
import type { Prediction } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { CountdownTimer } from './CountdownTimer';

const DOT_COLORS: Record<string, string> = {
  Created: 'bg-status-created',
  Funded: 'bg-status-funded',
  Resolving: 'bg-status-resolving',
  Settled: 'bg-status-settled',
  Expired: 'bg-status-expired',
};

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function TimelineItem({ prediction }: { prediction: Prediction }) {
  const { escrowAddress, description, state, stakeAmount, deadline, partyYes, resolvedYes } = prediction;

  return (
    <div className="relative pl-6">
      <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${DOT_COLORS[state] || 'bg-gray-500'}`} />
      <Link href={`/prediction/${escrowAddress}`} className="block bg-navy-800 border border-navy-700/50 rounded-lg p-4 hover:border-gray-600 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <p className="text-white text-sm font-medium flex-1 mr-4">{description || 'Untitled prediction'}</p>
          <StatusBadge state={state} />
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{stakeAmount} USDC</span>
          <span className="font-mono">{truncateAddress(escrowAddress)}</span>
          {state === 'Settled' && (
            <span className="text-status-settled">Outcome: {resolvedYes ? 'YES' : 'NO'}</span>
          )}
          {(state === 'Created' || state === 'Funded') && (
            <CountdownTimer targetTimestamp={deadline} />
          )}
          {state === 'Resolving' && (
            <span className="text-status-resolving">UMA dispute window active</span>
          )}
        </div>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Create Timeline**

Create `frontend/components/Timeline.tsx`:
```tsx
import type { Prediction } from '@/lib/types';
import { TimelineItem } from './TimelineItem';

export function Timeline({ predictions }: { predictions: Prediction[] }) {
  if (predictions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No predictions yet. Submit one to get started.
      </div>
    );
  }

  return (
    <div className="border-l-2 border-navy-700 ml-1.5 space-y-4">
      {predictions.map((p) => (
        <TimelineItem key={p.escrowAddress} prediction={p} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/TimelineItem.tsx frontend/components/Timeline.tsx
git commit -m "feat: add Timeline and TimelineItem components"
```

### Task 8: NewPredictionModal component

**Files:**
- Create: `frontend/components/NewPredictionModal.tsx`

- [ ] **Step 1: Create modal component**

Create `frontend/components/NewPredictionModal.tsx`:
```tsx
'use client';

import { useState } from 'react';

export function NewPredictionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prediction, setPrediction] = useState('');
  const [stakeAmount, setStakeAmount] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prediction, stakeAmount, deadline: deadline || undefined }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setResult({ success: true, message: data.message || 'Submitted!' });
        setPrediction('');
        setStakeAmount('1');
        setDeadline('');
      } else {
        setResult({ success: false, message: data.error || 'Failed to submit' });
      }
    } catch {
      setResult({ success: false, message: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white text-lg font-semibold mb-4">New Prediction</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Prediction</label>
            <textarea
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              placeholder="Will ETH hit $5,000 by June 2026?"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
              rows={3}
              required
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Stake (USDC)</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          {result && (
            <p className={`text-sm ${result.success ? 'text-status-settled' : 'text-red-400'}`}>
              {result.message}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !prediction}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white font-medium"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/NewPredictionModal.tsx
git commit -m "feat: add NewPredictionModal component"
```

---

## Chunk 4: Pages

### Task 9: Home page

**Files:**
- Create: `frontend/components/HomeClient.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create HomeClient (client component with state)**

Create `frontend/components/HomeClient.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import type { Prediction, EscrowState } from '@/lib/types';
import { Timeline } from './Timeline';
import { NewPredictionModal } from './NewPredictionModal';

const FILTERS: (EscrowState | 'All')[] = ['All', 'Created', 'Funded', 'Resolving', 'Settled'];

export function HomeClient({ initial }: { initial: Prediction[] }) {
  const [predictions, setPredictions] = useState(initial);
  const [filter, setFilter] = useState<EscrowState | 'All'>('All');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const resp = await fetch('/api/predictions');
        const data = await resp.json();
        if (data.predictions) setPredictions(data.predictions);
      } catch {}
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'All' ? predictions : predictions.filter((p) => p.state === filter);

  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white">Prediction Market</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white font-medium"
        >
          + New Prediction
        </button>
      </header>

      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-navy-700 text-gray-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Timeline predictions={filtered} />
      <NewPredictionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Update page.tsx to be a server component that fetches initial data**

Replace `frontend/app/page.tsx`:
```tsx
import { getAllPredictions } from '@/lib/contracts';
import { HomeClient } from '@/components/HomeClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let predictions;
  try {
    predictions = await getAllPredictions();
  } catch {
    predictions = [];
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <HomeClient initial={predictions} />
    </main>
  );
}
```

- [ ] **Step 3: Verify home page renders**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` — should show dark themed page with "Prediction Market" header, filter tabs, and timeline (possibly empty or with real escrows from factory). Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/HomeClient.tsx frontend/app/page.tsx
git commit -m "feat: add home page with timeline feed and filters"
```

### Task 10: PipelineStepper and JuryCard components

**Files:**
- Create: `frontend/components/PipelineStepper.tsx`
- Create: `frontend/components/JuryCard.tsx`

- [ ] **Step 1: Create PipelineStepper**

Create `frontend/components/PipelineStepper.tsx`:
```tsx
import type { EscrowState } from '@/lib/types';

const STEPS: EscrowState[] = ['Created', 'Funded', 'Resolving', 'Settled'];

const STEP_INDEX: Record<EscrowState, number> = {
  Created: 0,
  Funded: 1,
  Resolving: 2,
  Settled: 3,
  Expired: -1,
};

export function PipelineStepper({ current }: { current: EscrowState }) {
  const currentIdx = STEP_INDEX[current];

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 ${
                  done
                    ? 'bg-status-settled border-status-settled text-black'
                    : active
                      ? 'border-purple-500 text-purple-400'
                      : 'border-navy-700 text-gray-600'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 ${active ? 'text-white' : 'text-gray-500'}`}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${done ? 'bg-status-settled' : 'bg-navy-700'}`} />
            )}
          </div>
        );
      })}
      {current === 'Expired' && (
        <span className="ml-4 text-status-expired text-xs font-medium">EXPIRED</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create JuryCard**

Create `frontend/components/JuryCard.tsx`:
```tsx
import type { JuryVote } from '@/lib/types';

export function JuryCard({ vote }: { vote: JuryVote }) {
  return (
    <div className="bg-navy-900 border border-navy-700 rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-gray-400 uppercase">{vote.role}</span>
        <span className={`text-xs font-bold ${vote.vote ? 'text-status-settled' : 'text-red-400'}`}>
          {vote.vote ? 'YES' : 'NO'}
        </span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{vote.reasoning}</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/PipelineStepper.tsx frontend/components/JuryCard.tsx
git commit -m "feat: add PipelineStepper and JuryCard components"
```

### Task 11: Prediction detail page

**Files:**
- Create: `frontend/app/prediction/[address]/page.tsx`

- [ ] **Step 1: Create detail page**

Create `frontend/app/prediction/[address]/page.tsx`:
```tsx
import Link from 'next/link';
import { getEscrowState } from '@/lib/contracts';
import { getAgentMetadata } from '@/lib/openserv';
import { StatusBadge } from '@/components/StatusBadge';
import { PipelineStepper } from '@/components/PipelineStepper';
import { JuryCard } from '@/components/JuryCard';
import { CountdownTimer } from '@/components/CountdownTimer';
import type { Address } from 'viem';

export const dynamic = 'force-dynamic';

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const ZERO_ASSERTION = '0x0000000000000000000000000000000000000000000000000000000000000000';

export default async function PredictionPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  let prediction;
  try {
    prediction = await getEscrowState(address as Address);
    const meta = await getAgentMetadata(address);
    if (meta) Object.assign(prediction, meta);
  } catch (e: any) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm mb-4 block">← Back</Link>
        <p className="text-red-400">Failed to load prediction: {e.message}</p>
      </main>
    );
  }

  const basescanUrl = `https://sepolia.basescan.org/address/${address}`;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm mb-6 block">← Back</Link>

      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-xl font-bold text-white flex-1 mr-4">
            {prediction.description || 'Untitled prediction'}
          </h1>
          <StatusBadge state={prediction.state} />
        </div>
        <PipelineStepper current={prediction.state} />
      </div>

      {/* Escrow Info */}
      <section className="bg-navy-800 border border-navy-700 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Escrow Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Contract</span>
            <a href={basescanUrl} target="_blank" rel="noopener noreferrer" className="block font-mono text-purple-400 hover:text-purple-300">
              {truncateAddress(address)}
            </a>
          </div>
          <div>
            <span className="text-gray-500">Stake</span>
            <p className="text-white">{prediction.stakeAmount} USDC</p>
          </div>
          <div>
            <span className="text-gray-500">Party YES</span>
            <p className="font-mono text-white">{truncateAddress(prediction.partyYes)}</p>
          </div>
          <div>
            <span className="text-gray-500">Party NO</span>
            <p className="font-mono text-white">{truncateAddress(prediction.partyNo)}</p>
          </div>
          <div>
            <span className="text-gray-500">Deadline</span>
            <p className="text-white">{new Date(prediction.deadline * 1000).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Time Left</span>
            <CountdownTimer targetTimestamp={prediction.deadline} />
          </div>
        </div>
      </section>

      {/* UMA Section — visible when Resolving */}
      {prediction.state === 'Resolving' && prediction.assertionId !== ZERO_ASSERTION && (
        <section className="bg-navy-800 border border-status-resolving/30 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-status-resolving uppercase mb-3">UMA Dispute Window</h2>
          <div className="text-sm">
            <p className="text-gray-400 mb-1">Assertion ID</p>
            <a
              href={`https://testnet.oracle.uma.xyz/assertion/${prediction.assertionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-purple-400 hover:text-purple-300 text-xs break-all block"
            >
              {prediction.assertionId}
            </a>
            <p className="text-status-resolving text-xs mt-2">2hr liveness period active. Call settle-assertion after window closes.</p>
          </div>
        </section>
      )}

      {/* Settlement Section — visible when Settled */}
      {prediction.state === 'Settled' && (
        <section className="bg-navy-800 border border-status-settled/30 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-status-settled uppercase mb-3">Settlement</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Outcome</span>
              <p className={`font-bold ${prediction.resolvedYes ? 'text-status-settled' : 'text-red-400'}`}>
                {prediction.resolvedYes ? 'YES' : 'NO'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Winner</span>
              <p className="font-mono text-white">
                {truncateAddress(prediction.resolvedYes ? prediction.partyYes : prediction.partyNo)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Jury Section — visible when resolving or settled, if votes available */}
      {prediction.juryVotes && prediction.juryVotes.length > 0 && (
        <section className="mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Jury Votes</h2>
          <div className="space-y-3">
            {prediction.juryVotes.map((vote) => (
              <JuryCard key={vote.agentId} vote={vote} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify detail page renders**

```bash
cd frontend && npm run dev
```

Navigate to `http://localhost:3000/prediction/0x9b1FadF45efF6d84b7C988bCF7eE8fb06ccb0fdc` (the known funded escrow). Should show escrow details. Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/prediction/
git commit -m "feat: add prediction detail page with stepper, UMA, and settlement sections"
```

---

## Chunk 5: Final Verification

### Task 12: Type-check, build, and clean up

**Files:**
- Modify: `frontend/app/globals.css` (if needed — remove default Next.js landing styles)

- [ ] **Step 1: Clean up default Next.js styles**

Remove any default content/styles from `frontend/app/globals.css` except the Tailwind directives and any base dark theme styles. Keep only:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run production build**

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Verify full flow**

```bash
cd frontend && npm run dev
```

Test:
1. Home page loads with timeline (possibly empty)
2. Filter tabs switch between states
3. Click a prediction → detail page loads with stepper, escrow info
4. "New Prediction" button opens modal
5. `/api/predictions` returns JSON

Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/
git commit -m "chore: clean up defaults and verify build"
```

# Home Page Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home page impressive for hackathon judges with branding, stats bar, and refined cards.

**Architecture:** Pure UI changes to 3 existing files. No new files, no new APIs, no tests (visual-only changes). All data computed client-side from the existing `predictions` array.

**Tech Stack:** Next.js 16, Tailwind CSS v4, TypeScript

---

## Chunk 1: All Changes

### Task 1: Update page metadata

**Files:**
- Modify: `frontend/app/layout.tsx:8-11`

- [ ] **Step 1: Update metadata title and description**

```tsx
export const metadata: Metadata = {
  title: "Longtail",
  description: "Agent-powered P2P prediction market on Base",
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/layout.tsx
git commit -m "polish: update page title to Longtail"
```

### Task 2: Rebrand header, add stats bar, update filters

**Files:**
- Modify: `frontend/components/HomeClient.tsx`

- [ ] **Step 1: Add JuryResolving to FILTERS array**

Change line 9 from:
```tsx
const FILTERS: (EscrowState | 'All')[] = ['All', 'Created', 'Funded', 'Resolving', 'Settled'];
```
To:
```tsx
const FILTERS: (EscrowState | 'All')[] = ['All', 'Created', 'Funded', 'JuryResolving', 'Resolving', 'Settled'];
```

- [ ] **Step 2: Add stats computation and filter counts inside component**

Add after the `const [fetchError, ...` line, before `useEffect`:

```tsx
const ACTIVE_STATES = new Set(['Funded', 'Resolving', 'JuryResolving']);

const stats = {
  total: predictions.length,
  staked: predictions.reduce((sum, p) => {
    const amt = parseFloat(p.stakeAmount) || 0;
    return sum + (p.state === 'Created' ? amt : amt * 2);
  }, 0),
  active: predictions.filter((p) => ACTIVE_STATES.has(p.state)).length,
};

const counts = predictions.reduce<Record<string, number>>((acc, p) => {
  acc[p.state] = (acc[p.state] || 0) + 1;
  return acc;
}, {});
```

- [ ] **Step 3: Replace header with branded version**

Replace the existing `<header>` block (lines 37-48) with:

```tsx
<header className="mb-8">
  <div className="flex justify-between items-start mb-1">
    <div>
      <h1 className="text-3xl font-bold inline-block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
        Longtail
      </h1>
      <p className="text-gray-500 text-sm mt-1">Agent-powered P2P predictions on Base</p>
    </div>
    <div className="flex items-center gap-3">
      <ConnectButton />
      <button
        onClick={() => setModalOpen(true)}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white font-medium"
      >
        + New Prediction
      </button>
    </div>
  </div>
</header>
```

- [ ] **Step 4: Add stats bar between header and filters**

Insert after `</header>` and before the filter `<div className="flex gap-2 mb-6">`:

```tsx
<div className="flex gap-4 mb-6">
  <div className="flex-1 bg-navy-800 border border-navy-700 rounded-lg px-4 py-3">
    <p className="text-xs text-gray-500 uppercase">Markets</p>
    <p className="text-lg font-bold text-white">{stats.total}</p>
  </div>
  <div className="flex-1 bg-navy-800 border border-navy-700 rounded-lg px-4 py-3">
    <p className="text-xs text-gray-500 uppercase">Total Staked</p>
    <p className="text-lg font-bold text-white">{stats.staked % 1 === 0 ? stats.staked : stats.staked.toFixed(2)} USDC</p>
  </div>
  <div className="flex-1 bg-navy-800 border border-navy-700 rounded-lg px-4 py-3">
    <p className="text-xs text-gray-500 uppercase">Active</p>
    <p className="text-lg font-bold text-white">{stats.active}</p>
  </div>
</div>
```

- [ ] **Step 5: Update filter buttons to show counts**

Replace the filter button content from:
```tsx
{f}
```
To:
```tsx
{f} ({f === 'All' ? predictions.length : counts[f] || 0})
```

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/components/HomeClient.tsx
git commit -m "polish: rebrand header, add stats bar and filter counts"
```

### Task 3: Refine timeline card stake badge

**Files:**
- Modify: `frontend/components/TimelineItem.tsx:38-40`

- [ ] **Step 1: Replace plain stake text with styled badge**

In the metadata `<div>` (line 38-53), replace:
```tsx
<span>{stakeAmount} USDC</span>
```
With:
```tsx
<span className="bg-navy-900 border border-navy-700 rounded-full px-2 py-0.5 text-xs text-gray-300 ml-auto">
  {state === 'Created' ? `Stake: ${stakeAmount} USDC` : `Pool: ${parseFloat(stakeAmount) * 2} USDC`}
</span>
```

Move this badge to the end of the metadata div (after the conditional status spans) so `ml-auto` pushes it right.

- [ ] **Step 2: Add parseFloat import note**

No import needed — `parseFloat` is a global. But ensure the metadata row still uses `flex` layout (it already has `className="flex items-center gap-4 ..."`).

- [ ] **Step 3: Type-check and build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: no errors, build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/components/TimelineItem.tsx
git commit -m "polish: add stake/pool badge to prediction cards"
```

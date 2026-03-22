@AGENTS.md

## Stack
Next.js 16 (App Router), Tailwind CSS v4, wagmi v3 (wallet connection), viem (on-chain reads)

## Key Components
- `components/Providers.tsx` — WagmiProvider + QueryClientProvider wrapper
- `components/FundButton.tsx` — USDC approve → deposit flow, handles open matching
- `components/SettleJuryButton.tsx` / `ChallengeJuryButton.tsx` — jury resolution actions
- `components/SettleButton.tsx` — UMA settleAssertion call
- `lib/contracts.ts` — multicall reads from factory + escrows
- `app/api/predict/route.ts` — LLM validation gate + webhook trigger

## Gotchas
- All wallet-dependent components need `mounted` state guard to prevent hydration mismatch
- wagmi config requires `ssr: true` in `lib/wagmi.ts`

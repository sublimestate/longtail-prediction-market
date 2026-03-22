# Agent Instructions

This is a monorepo with three workspaces: `contracts/`, `agents/`, `frontend/`. Each has its own `package.json` and `tsconfig.json`.

## Key Patterns

- **Contracts** use Hardhat with Solidity 0.8.24. ABIs are in `contracts/artifacts/`.
- **Agents** are ESM TypeScript (`"type": "module"`). Shared blockchain helpers live in `agents/src/shared/blockchain.ts`. All on-chain calls use viem.
- **Frontend** is Next.js 16 (App Router). Wallet interactions use wagmi. All wallet-dependent components need a `mounted` state guard to prevent hydration mismatch.
- **OpenServ SDK** — agents register capabilities (tools) and connect via WebSocket. `provision()` auto-creates agents on first run and stores state in `.openserv.json` at `process.cwd()`.
- **OpenServ Client** — used for platform API calls (task search, workspace management). Auth header is `x-openserv-key`, NOT `Authorization: Bearer`.

## Commands

```bash
# Type-check everything
cd contracts && npx hardhat compile
cd agents && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Run tests
cd contracts && npx hardhat test
cd agents && npx vitest run

# Start dev
cd agents && npm run start          # All 3 agents
cd frontend && npm run dev          # Next.js on :3000
```

## Environment

Required in `.env` (project root):
- `DEPLOYER_PRIVATE_KEY` — wallet for contract deployment and agent transactions
- `FACTORY_ADDRESS` — deployed EscrowFactory address on Base Sepolia

Required in `frontend/.env.local`:
- `FACTORY_ADDRESS`, `BASE_SEPOLIA_RPC_URL`, `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`
- `WEBHOOK_TOKEN`, `OPENSERV_API_KEY`, `OPENSERV_USER_API_KEY`
- `OPENAI_API_KEY`

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| EscrowFactory | `0xe6d97155DB6e01De84148F4009dE1F986612a97B` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| UMA Optimistic Oracle v3 | `0x0F7fC5E6482f096380db6158f978167b57388deE` |

Each prediction deploys its own `PredictionEscrow` proxy via the factory.

## Gotchas

- Workflow task bodies must include explicit tool-call instructions ("You MUST call the X tool") or the platform LLM answers directly instead of invoking agent capabilities.
- `setup-workflow.ts` must be run from the project root (`npx tsx agents/src/setup-workflow.ts`) because `provision()` resolves `.openserv.json` from `process.cwd()`.
- Starting all 3 agents simultaneously causes SIWE auth race conditions. Stagger starts by 8 seconds.
- On-chain tool calls in task bodies should say "call EXACTLY ONCE" to prevent nonce conflicts from platform retries.

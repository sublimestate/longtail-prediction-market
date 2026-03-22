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

## Interacting Without the Frontend

You can interact with Longtail entirely on-chain using `cast` (from Foundry) or any wallet. All contracts are on **Base Sepolia** (chain ID 84532).

### 1. Browse existing predictions

Query the factory for all deployed escrows:

```bash
# Get escrow count
cast call 0xe6d97155DB6e01De84148F4009dE1F986612a97B "escrowCount()" --rpc-url https://sepolia.base.org

# Get escrow address by index (0-based)
cast call 0xe6d97155DB6e01De84148F4009dE1F986612a97B "escrows(uint256)" 0 --rpc-url https://sepolia.base.org
```

### 2. Read escrow state

```bash
ESCROW=0x...  # address from step above
RPC=https://sepolia.base.org

cast call $ESCROW "description()" --rpc-url $RPC | cast --to-ascii
cast call $ESCROW "stakeAmount()" --rpc-url $RPC
cast call $ESCROW "deadline()" --rpc-url $RPC
cast call $ESCROW "state()" --rpc-url $RPC          # 0=Created, 1=Funded, 2=Resolving, 3=JuryResolving, 4=Settled, 5=Expired
cast call $ESCROW "partyYes()" --rpc-url $RPC
cast call $ESCROW "partyNo()" --rpc-url $RPC         # address(0) means open for matching
```

### 3. Match an open prediction (take the NO side)

Approve USDC and call `deposit()` — if `partyNo` is `address(0)`, anyone can claim it:

```bash
USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
STAKE=$(cast call $ESCROW "stakeAmount()" --rpc-url $RPC)

# Approve USDC transfer
cast send $USDC "approve(address,uint256)" $ESCROW $STAKE --rpc-url $RPC --private-key $PK

# Deposit (claims NO side and moves escrow to Funded)
cast send $ESCROW "deposit()" --rpc-url $RPC --private-key $PK
```

### 4. Settle after jury resolution

After the resolution agent's jury proposes an outcome, a challenge window starts. If unchallenged:

```bash
# Settle jury resolution (anyone can call after challenge window expires)
cast send $ESCROW "settleJuryResolution()" --rpc-url $RPC --private-key $PK
```

### 5. Challenge jury resolution

If you disagree with the jury's outcome, escalate to UMA:

```bash
# Challenge (resets to Funded, escalates to UMA Optimistic Oracle)
cast send $ESCROW "challengeJuryResolution()" --rpc-url $RPC --private-key $PK
```

### 6. Settle UMA assertion

After UMA's 2-hour liveness window:

```bash
OOV3=0x0F7fC5E6482f096380db6158f978167b57388deE
ASSERTION_ID=$(cast call $ESCROW "assertionId()" --rpc-url $RPC)

cast send $OOV3 "settleAssertion(bytes32)" $ASSERTION_ID --rpc-url $RPC --private-key $PK
```

### 7. Create a prediction via the agent pipeline

Trigger the webhook to start the full agent flow (Market Maker → Contract Deployer → Resolution):

```bash
curl -X POST https://frontend-ten-pearl-39.vercel.app/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "prediction": "Will ETH be above $5000 by April 1 2026?",
    "deadline": "2026-04-01",
    "stakeAmount": "1",
    "challengeWindow": 300
  }'
```

## Gotchas

- Workflow task bodies must include explicit tool-call instructions ("You MUST call the X tool") or the platform LLM answers directly instead of invoking agent capabilities.
- `setup-workflow.ts` must be run from the project root (`npx tsx agents/src/setup-workflow.ts`) because `provision()` resolves `.openserv.json` from `process.cwd()`.
- Starting all 3 agents simultaneously causes SIWE auth race conditions. Stagger starts by 8 seconds.
- On-chain tool calls in task bodies should say "call EXACTLY ONCE" to prevent nonce conflicts from platform retries.

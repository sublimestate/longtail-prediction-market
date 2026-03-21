# Long-Tail Prediction Market — Agent-Powered P2P Bets

## The Idea

Multi-agent system on OpenServ: propose predictions, find counterparties, deploy escrow contracts on Base, settle outcomes autonomously via UMA oracle.

## Commands

```bash
# Contracts
cd contracts && npx hardhat compile   # Compile Solidity
cd contracts && npx hardhat test      # Run all 12 contract tests
cd contracts && npx hardhat run scripts/deploy.ts --network baseSepolia  # Deploy factory

# Agents
cd agents && npm run start            # Start all 4 agents (auto-provisions on first run)
cd agents && npm run setup-workflow   # Create multi-agent pipeline workflow
cd agents && npx tsc --noEmit         # Type-check agent code
```

## Project Structure

Monorepo with two npm workspaces:
- `contracts/` — Hardhat, Solidity 0.8.24, OpenZeppelin v5, Base Sepolia
- `agents/` — OpenServ SDK v2.x + Client v2.x, viem, ESM modules
- Key contracts: `PredictionEscrow.sol`, `EscrowFactory.sol`
- Key shared code: `agents/src/shared/blockchain.ts` (viem clients + contract helpers)
- Key scripts: `agents/src/setup-workflow.ts` (creates pipeline workflow)

## Environment

Required in `.env`:
- `DEPLOYER_PRIVATE_KEY`, `COUNTERPARTY_PRIVATE_KEY`
- `FACTORY_ADDRESS` (set after deploying EscrowFactory)

Auto-created by `provision()`:
- `WALLET_PRIVATE_KEY` — OpenServ platform wallet (saved to `.env` and `.openserv.json`)
- Agent API keys and auth tokens — stored in `.openserv.json`

## Hackathon

- **Event:** The Synthesis
- **Tracks:** Ship Something Real with OpenServ, Best OpenServ Build Story, Agent Services on Base
- **Stack:** OpenServ SDK + Client (TypeScript), Solidity, Base Sepolia
Hackathon URL: https://synthesis.md/

## Agent Architecture

### 1. Market Maker Agent
- Accepts natural language predictions from users or agents
- Structures them into a formal spec: event description, deadline, resolution criteria, stake
- Clarifies ambiguity through conversation

### 2. Matchmaker Agent
- Maintains a pool of open predictions
- Searches for opposing views when a new prediction arrives
- Auto-assigns pre-funded agent wallet if no human counterparty found

### 3. Contract Deployer Agent
- Deploys per-prediction escrow contracts on Base using an audited factory pattern
- Never generates Solidity — only fills in parameters (parties, stake, deadline, resolution agent)
- Uses `EscrowFactory.createEscrow()` to deploy identical, audited `PredictionEscrow` instances
- Contract uses OpenZeppelin primitives (ReentrancyGuard, SafeERC20)

### 4. Oracle / Resolution Agent
- When the deadline hits, gathers evidence (on-chain data, APIs, news)
- Multi-agent jury: 3 sequential LLM evaluations (skeptic, optimist, arbiter) within one agent, majority wins
- Submits claim text to the escrow contract, which calls UMA OOv3 directly
- UMA dispute window (2hr) — losing party can dispute; escalates to DVM voters if challenged
- After settlement, UMA calls back into the escrow contract to release funds

### Agent Provisioning
- All agents self-provision on first start via `provision()` from `@openserv-labs/client`
- Resolution jury uses `generate()` for platform-delegated LLM calls (no OpenAI key needed)
- `setup-workflow.ts` creates the unified pipeline: Webhook → Market Maker → Matchmaker → Deployer → Resolution
- Agent IDs and credentials stored in `.openserv.json` (gitignored)

## Decisions

### Resolution Trust
UMA Optimistic Oracle V3 on Base is the on-chain truth layer.
- Escrow contract calls UMA directly (agent only provides claim text, cannot fake assertionId)
- Dispute window protects against wrong proposals — losing party has financial incentive to dispute
- Disputed outcomes escalate to Ethereum mainnet DVM voters as final arbiter
- UMA OOv3 Base Mainnet: `0x2aBf1Bd76655de80eDB3086114315Eec75AF500c`
- UMA OOv3 Base Sepolia: `0x0F7fC5E6482f096380db6158f978167b57388deE`

### Hackathon Scope
Full end-to-end flow. Counterparty pre-seeded via agent wallet. Factory deployed at `0x835a91497987D21F8Cb92336190BC99Cc90908F7` on Base Sepolia.

### Counterparty Discovery
Combine active matchmaking + agent counterparty:
- Matchmaker agent searches pool for a human counterparty first
- If none found, an opposing agent automatically takes the other side
- Ensures market always has liquidity and demo never stalls
- **Note:** Revisit this approach before production — agent counterparty is a band-aid for the liquidity bootstrapping problem.

### Contract Security
Audited template + factory pattern:
- One `PredictionEscrow.sol` contract, reused for every bet
- `EscrowFactory` deploys instances with per-bet parameters only
- Agent never writes or modifies Solidity — only provides deployment parameters
- Uses OpenZeppelin v5 primitives (ReentrancyGuard, SafeERC20)

### Regulatory
Non-custodial P2P infrastructure. Avoid sports/elections content without legal review.

## Gotchas

- **SIWE race condition**: Starting all 4 agents simultaneously causes wallet auth failures. `start-all.ts` staggers starts by 8 seconds.
- **`.openserv.json` state**: `provision()` stores agent IDs/credentials here. `getProvisionedInfo()` requires the exact workflow name as the second argument.
- **`generate()` fallback**: Resolution jury uses `generate()` for LLM calls but falls back to deterministic logic if it fails (e.g., demo Trump prediction always returns YES).
- **Escrow deadline**: Must be in the future at deployment time, even if the prediction evaluates a past event.

# Long-Tail Prediction Market — Agent-Powered P2P Bets

## The Idea

Multi-agent system on OpenServ: propose predictions, find counterparties, deploy escrow contracts on Base, settle outcomes autonomously via UMA oracle.

## Commands

```bash
# Contracts
cd contracts && npx hardhat compile   # Compile Solidity
cd contracts && npx hardhat test      # Run all 12 contract tests

# Agents (requires env vars set)
cd agents && npm run start            # Start all 4 agents (ports 7378-7381)
cd agents && npx tsc --noEmit         # Type-check agent code
```

## Project Structure

Monorepo with two npm workspaces:
- `contracts/` — Hardhat, Solidity 0.8.24, OpenZeppelin v5
- `agents/` — OpenServ SDK v2.x, viem, ESM modules
- Key contracts: `PredictionEscrow.sol`, `EscrowFactory.sol`
- Key shared code: `agents/src/shared/blockchain.ts` (viem clients + contract helpers)

## Environment

Required in `.env`:
- `OPENSERV_API_KEY_MARKET_MAKER`, `_MATCHMAKER`, `_DEPLOYER`, `_RESOLUTION`
- `DEPLOYER_PRIVATE_KEY`, `COUNTERPARTY_PRIVATE_KEY`
- `FACTORY_ADDRESS` (set after deploying EscrowFactory)
- `OPENAI_API_KEY` (for resolution jury in production)

## Hackathon

- **Event:** The Synthesis
- **Tracks:** Ship Something Real with OpenServ, Best OpenServ Build Story, Agent Services on Base
- **Stack:** OpenServ SDK (TypeScript), Solidity, Base Mainnet

## Agent Architecture

### 1. Market Maker Agent
- Accepts natural language predictions from users or agents
- Structures them into a formal spec: event description, deadline, resolution criteria, stake
- Clarifies ambiguity through conversation

### 2. Matchmaker Agent
- Maintains a pool of open predictions
- Searches for opposing views when a new prediction arrives
- Handles odds negotiation between two sides

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

## Decisions

### Resolution Trust
UMA Optimistic Oracle V3 on Base is the on-chain truth layer.
- Escrow contract calls UMA directly (agent only provides claim text, cannot fake assertionId)
- Dispute window protects against wrong proposals — losing party has financial incentive to dispute
- Disputed outcomes escalate to Ethereum mainnet DVM voters as final arbiter
- UMA OOv3 Base Mainnet: `0x2aBf1Bd76655de80eDB3086114315Eec75AF500c`
- UMA OOv3 Base Sepolia: `0x0F7fC5E6482f096380db6158f978167b57388deE`

### Hackathon Scope
Full end-to-end flow. Demo prediction: "Is Donald Trump still President as of March 20, 2026 3:00pm ET?" Pre-seed the counterparty to de-risk the demo.

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

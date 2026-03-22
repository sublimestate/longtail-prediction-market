# Long-Tail Prediction Market — Agent-Powered P2P Bets

## The Idea

Multi-agent system on OpenServ: propose predictions, find counterparties, deploy escrow contracts on Base, settle outcomes autonomously via UMA oracle.

## Commands

```bash
# Contracts
cd contracts && npx hardhat compile   # Compile Solidity
cd contracts && npx hardhat test      # Run contract tests
cd contracts && npx hardhat run scripts/deploy.ts --network baseSepolia  # Deploy factory

# Agents
cd agents && npm run start            # Start all 4 agents (auto-provisions on first run)
npx tsx agents/src/setup-workflow.ts  # Create pipeline workflow (run from project root!)
cd agents && npx tsc --noEmit         # Type-check agent code
cd agents && npx vitest run           # Run agent tests
```

## Project Structure

Monorepo with two npm workspaces:
- `contracts/` — Hardhat, Solidity 0.8.24, OpenZeppelin v5, Base Sepolia
- `agents/` — OpenServ SDK v2.x + Client v2.x, viem, ESM modules
- Key contracts: `PredictionEscrow.sol`, `EscrowFactory.sol`
- Key shared code: `agents/src/shared/blockchain.ts` (viem clients + contract helpers)
- Key shared code: `agents/src/shared/types.ts` (`parsePredictionSpec` — normalizes agent output formats)
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

4 agents form a pipeline: **Market Maker** (structures predictions) → **Matchmaker** (finds counterparty or assigns agent wallet) → **Contract Deployer** (deploys escrow via factory, never writes Solidity) → **Resolution** (3-member LLM jury, submits UMA claim, settles after liveness).

### Agent Provisioning
- All agents self-provision on first start via `provision()` from `@openserv-labs/client`
- Resolution jury uses `generate()` for platform-delegated LLM calls (no OpenAI key needed)
- `setup-workflow.ts` creates the unified pipeline: Webhook → Market Maker → Matchmaker → Deployer → Resolution
- Agent IDs and credentials stored in `.openserv.json` (gitignored)

## Decisions

- **Resolution trust:** UMA OOv3 on Base. Escrow calls UMA directly — agent only provides claim text. 2hr dispute window, escalates to DVM if challenged.
- **Counterparty:** Matchmaker searches for humans first, falls back to agent wallet. Band-aid for liquidity — revisit before production.
- **Contract security:** Audited factory pattern. Agent never writes Solidity, only provides deployment params. OpenZeppelin v5 primitives.
- **Regulatory:** Non-custodial P2P. Avoid sports/elections content without legal review.

## Gotchas

- **UMA does not auto-settle**: After `initiateResolution()`, someone must call `settle-assertion` on the resolution agent after the 2hr liveness window. Without this, the escrow stays in "Resolving" forever and funds remain locked.
- **SIWE race condition**: Starting all 4 agents simultaneously causes wallet auth failures. `start-all.ts` staggers starts by 8 seconds.
- **`.openserv.json` state**: `provision()` stores agent IDs/credentials here. `getProvisionedInfo()` requires the exact workflow name as the second argument.
- **`generate()` fallback**: Resolution jury uses `generate()` for LLM calls but falls back to deterministic logic if it fails (e.g., demo Trump prediction always returns YES).
- **Escrow deadline**: Must be in the future at deployment time, even if the prediction evaluates a past event.
- **Workflow task bodies**: Must include explicit tool-call instructions (e.g., "You MUST call the X tool"). Without this, the platform LLM answers tasks directly instead of invoking agent capabilities.
- **`.openserv.json` cwd**: Agents write to project root (via `start-all.ts` cwd), but `setup-workflow.ts` reads from its own cwd. Always run `setup-workflow.ts` from the project root.
- **Nonce race on retry**: The platform LLM may retry blockchain tool calls, causing nonce conflicts. Task bodies should say "call EXACTLY ONCE" for on-chain operations.
- **RPC allowance propagation**: Base Sepolia public RPC can lag — `approve()` receipt returns but `transferFrom()` sees stale allowance. `deposit()` in `blockchain.ts` polls allowance before calling the escrow's `deposit()`.
- **Deployment mutex**: Contract Deployer uses an in-memory `deployInProgress` flag to block concurrent `deploy-escrow` calls. Platform retries are rejected immediately instead of causing nonce races.
- **USDC pre-flight check**: Contract Deployer checks both wallets' USDC balances before deploying. Fails fast with the wallet address and shortfall instead of wasting gas on a doomed deployment.

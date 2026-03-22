# Longtail

Agent-powered P2P prediction market on Base. Three AI agents coordinate via [OpenServ](https://openserv.ai) to structure predictions, deploy USDC escrow contracts, and resolve outcomes using an LLM jury — with UMA Oracle as a fallback. No house edge, no curator, no limits on what you can bet on.

**Live demo:** [frontend-ten-pearl-39.vercel.app](https://frontend-ten-pearl-39.vercel.app)

## How It Works

1. **User submits a prediction** — any verifiable yes/no question with a deadline and USDC stake
2. **Market Maker agent** validates and structures the prediction
3. **Contract Deployer agent** deploys a `PredictionEscrow` on Base Sepolia and deposits the creator's stake
4. **Anyone can take the other side** — call `deposit()` on-chain to match the bet
5. **Resolution agent** convenes a 3-member LLM jury after the deadline, proposes an outcome with a challenge window
6. **Winner withdraws** — or either party can escalate to UMA's Optimistic Oracle for decentralized dispute resolution

## Project Structure

```
contracts/   Solidity — PredictionEscrow + EscrowFactory (Hardhat, Base Sepolia)
agents/      3 OpenServ agents — Market Maker, Contract Deployer, Resolution
frontend/    Next.js 16 + Tailwind CSS + wagmi — prediction explorer and wallet actions
```

## Quick Start

### Contracts

```bash
cd contracts
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network baseSepolia
```

### Agents

```bash
# Copy .env.example to .env and fill in DEPLOYER_PRIVATE_KEY + FACTORY_ADDRESS
cd agents
npm install
npm run start   # Auto-provisions agents on first run via OpenServ
```

Agents connect to OpenServ via WebSocket — no inbound ports needed. For production deployment, see `deploy-agents.sh` (pm2 + EC2).

### Frontend

```bash
cd frontend
cp .env.example .env.local  # Fill in env vars
npm install
npm run dev
```

## Architecture

```
User → Frontend → /api/predict → OpenServ Webhook
                                      ↓
                              Market Maker Agent
                                      ↓
                            Contract Deployer Agent → Base Sepolia (deploy + fund escrow)
                                      ↓
                              Resolution Agent → 3-member LLM jury → resolveByJury()
                                                                          ↓
                                                      Challenge window (configurable, min 5 min)
                                                          ↓                    ↓
                                                   No challenge           challengeJuryResolution()
                                                          ↓                    ↓
                                                settleJuryResolution()    UMA Optimistic Oracle (2hr liveness)
                                                          ↓                    ↓
                                                      Winner withdraws     settleAssertion() → Winner withdraws
```

## Tech Stack

- **Contracts:** Solidity 0.8.24, OpenZeppelin v5, Hardhat, Base Sepolia
- **Agents:** OpenServ SDK + Client, viem, TypeScript (ESM)
- **Frontend:** Next.js 16, Tailwind CSS v4, wagmi, viem
- **Oracle:** UMA Optimistic Oracle v3 (dispute fallback)
- **Token:** USDC on Base Sepolia

## Built For

[The Synthesis](https://synthesis.md/) hackathon — Ship Something Real with OpenServ

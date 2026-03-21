import 'dotenv/config';
import { Agent, run } from '@openserv-labs/sdk';
import { provision, triggers } from '@openserv-labs/client';
import { z } from 'zod';
import { getDeployerAddress, getCounterpartyAddress } from '../shared/blockchain.js';
import { parsePredictionSpec, type PredictionSpec } from '../shared/types.js';

const agent = new Agent({
  systemPrompt: `You are the Matchmaker agent for a long-tail prediction market. Your role is to:
1. Maintain a pool of open predictions
2. Search for counterparties when new predictions arrive
3. If no human counterparty is found, assign the pre-funded agent wallet as the opposing party
4. Forward matched predictions to the Contract Deployer agent

Always ensure every prediction gets matched — the system should never stall waiting for a counterparty.`,
});

// In-memory pool for demo purposes
const predictionPool: PredictionSpec[] = [];

agent.addCapability({
  name: 'match-prediction',
  description:
    'Receives a PredictionSpec and finds/assigns a counterparty. Input is the prediction spec JSON.',
  schema: z.object({
    prediction: z.string().describe('JSON string of the PredictionSpec to match'),
  }),
  async run({ args }) {
    let spec: PredictionSpec;
    try {
      spec = parsePredictionSpec(args.prediction);
    } catch (e) {
      return `Error: Invalid prediction JSON — ${e}`;
    }

    const deployerAddr = getDeployerAddress();
    const counterpartyAddr = getCounterpartyAddress();

    // Check pool for an existing counterparty
    const match = predictionPool.find(
      (p) => p.status === 'open' && p.description === spec.description && p.id !== spec.id,
    );

    if (match) {
      spec.partyYes = { address: deployerAddr };
      spec.partyNo = { address: match.partyYes?.address || counterpartyAddr };
      spec.status = 'matched';
      match.status = 'matched';

      return formatMatchResult(spec, 'human counterparty found in pool');
    }

    // No counterparty found — use agent wallet
    spec.partyYes = { address: deployerAddr };
    spec.partyNo = { address: counterpartyAddr };
    spec.status = 'matched';

    predictionPool.push(spec);

    return formatMatchResult(spec, 'auto-matched with agent counterparty (no human found)');
  },
});

agent.addCapability({
  name: 'check-pool',
  description: 'Lists open predictions in the matching pool.',
  schema: z.object({}),
  async run() {
    const open = predictionPool.filter((p) => p.status === 'open');

    if (open.length === 0) {
      return 'No open predictions in the matching pool.';
    }

    return `Open predictions (${open.length}):\n\`\`\`json\n${JSON.stringify(open, null, 2)}\n\`\`\``;
  },
});

function formatMatchResult(spec: PredictionSpec, method: string): string {
  return `Prediction matched (${method}):\n\`\`\`json\n${JSON.stringify(
    {
      id: spec.id,
      description: spec.description,
      partyYes: spec.partyYes?.address,
      partyNo: spec.partyNo?.address,
      stakeAmount: spec.stakeAmount,
      deadline: typeof spec.deadline === 'number' && spec.deadline > 0
        ? new Date(spec.deadline * 1000).toISOString()
        : String(spec.deadline),
      status: spec.status,
    },
    null,
    2,
  )}\n\`\`\`\n\nForwarded to Contract Deployer agent.`;
}

async function main() {
  const result = await provision({
    agent: {
      instance: agent,
      name: 'prediction-matchmaker',
      description:
        'Matches predictions with counterparties. Searches the pool for opposing views, or auto-assigns a pre-funded agent wallet if no human counterparty is found.',
    },
    workflow: {
      name: 'Prediction Matchmaker',
      goal: 'Find counterparties for open predictions by searching the pool or auto-assigning an agent wallet, then forward matched predictions to the contract deployer.',
      trigger: triggers.manual(),
      task: { description: 'Match prediction with counterparty' },
    },
  });

  console.log(`Matchmaker provisioned (agent ID: ${result.agentId})`);
  await run(agent);
}

main().catch(console.error);

export default agent;

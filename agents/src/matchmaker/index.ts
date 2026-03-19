import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import { config } from '../shared/config.js';
import { getDeployerAddress, getCounterpartyAddress } from '../shared/blockchain.js';
import type { PredictionSpec } from '../shared/types.js';

const agent = new Agent({
  port: config.ports.matchmaker,
  apiKey: config.openserv.matchmakerApiKey,
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
  description: 'Receives a PredictionSpec and finds/assigns a counterparty. Input is the prediction spec JSON.',
  schema: z.object({
    prediction: z.string().describe('JSON string of the PredictionSpec to match'),
  }),
  async run({ args, action }) {
    let spec: PredictionSpec;
    try {
      spec = JSON.parse(args.prediction);
    } catch {
      return 'Error: Invalid prediction JSON';
    }

    // The prediction creator takes the "Yes" side by default
    const deployerAddr = getDeployerAddress();
    const counterpartyAddr = getCounterpartyAddress();

    // Check pool for an existing counterparty
    const match = predictionPool.find(
      (p) => p.status === 'open' && p.description === spec.description && p.id !== spec.id
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

    // Create task for contract deployer
    if (action?.workspace?.id) {
      try {
        await agent.createTask({
          workspaceId: action.workspace.id,
          assignee: config.agentIds.deployer,
          description: `Deploy escrow for prediction: ${spec.description}`,
          body: JSON.stringify(spec),
          input: JSON.stringify(spec),
          expectedOutput: 'Deployed and funded escrow contract address',
          dependencies: [],
        });
      } catch (e) {
        console.error('Failed to create deployer task:', e);
      }
    }

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
      deadline: new Date(spec.deadline * 1000).toISOString(),
      status: spec.status,
    },
    null,
    2,
  )}\n\`\`\`\n\nForwarded to Contract Deployer agent.`;
}

agent.start().then(() => {
  console.log(`Matchmaker agent running on port ${config.ports.matchmaker}`);
});

export default agent;

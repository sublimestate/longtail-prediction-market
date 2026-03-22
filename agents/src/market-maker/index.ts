import 'dotenv/config';
import { Agent, run } from '@openserv-labs/sdk';
import { provision, triggers } from '@openserv-labs/client';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { PredictionSpec } from '../shared/types.js';

const agent = new Agent({
  systemPrompt: `You are the Market Maker agent for a long-tail prediction market. Your role is to:
1. Accept natural language predictions from users
2. Structure them into formal prediction specifications
3. Clarify any ambiguity through conversation

When structuring a prediction, extract:
- A clear event description
- A specific deadline (as a unix timestamp)
- Resolution criteria (how to determine the outcome)
- Suggested stake amount in USDC

Always respond with valid JSON matching the PredictionSpec format.`,
});

agent.addCapability({
  name: 'create-prediction',
  description:
    'Takes a natural language prediction and structures it into a formal PredictionSpec. Input should be a JSON object with "prediction" (string), optional "stakeAmount" (string, USDC), and optional "deadline" (ISO date string).',
  schema: z.object({
    prediction: z.string().describe('Natural language prediction statement'),
    stakeAmount: z.string().optional().describe('Stake amount in USDC (default: "10")'),
    deadline: z.string().optional().describe('Deadline as ISO date string'),
  }),
  async run({ args }) {
    const { prediction, stakeAmount = '10', deadline } = args;

    const deadlineTs = deadline
      ? Math.floor(new Date(deadline).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    const spec: PredictionSpec = {
      id: uuid(),
      description: prediction,
      deadline: deadlineTs,
      stakeAmount,
      resolutionCriteria: `Determine whether the following statement is true or false as of the deadline: "${prediction}". Use publicly available information, official sources, and news reports.`,
      status: 'open',
      createdAt: Math.floor(Date.now() / 1000),
    };

    return `Prediction created successfully:\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n\nThe prediction has been forwarded to the Matchmaker agent to find a counterparty.`;
  },
});

agent.addCapability({
  name: 'list-predictions',
  description: 'Lists all predictions. Returns a summary of current predictions.',
  schema: z.object({}),
  async run({ action }) {
    if (!action?.workspace?.id) {
      return 'No workspace context available. Please run within an OpenServ workspace.';
    }

    try {
      const tasks = await agent.getTasks({ workspaceId: action.workspace.id });
      const predictions = tasks
        .filter((t) => t.description?.includes('prediction'))
        .map((t) => ({
          id: t.id,
          description: t.description,
          status: t.status,
          output: t.output,
        }));

      if (predictions.length === 0) {
        return 'No predictions found in this workspace.';
      }

      return `Found ${predictions.length} prediction(s):\n\`\`\`json\n${JSON.stringify(predictions, null, 2)}\n\`\`\``;
    } catch (e) {
      return `Error listing predictions: ${e}`;
    }
  },
});

async function main() {
  const result = await provision({
    agent: {
      instance: agent,
      name: 'prediction-market-maker',
      description:
        'Accepts natural language predictions and structures them into formal specs with event description, deadline, resolution criteria, and stake amount.',
    },
    workflow: {
      name: 'Prediction Market Maker',
      goal: 'Accept natural language predictions from users, structure them into formal prediction specifications with deadline, stake, and resolution criteria, then forward to matchmaker.',
      trigger: triggers.manual(),
      task: { description: 'Process prediction request' },
    },
  });

  console.log(`Market Maker provisioned (agent ID: ${result.agentId})`);
  const runResult = await run(agent);

  const { startKeepAlive } = await import('../shared/keepalive.js');
  startKeepAlive(runResult, 'Market Maker');
}

main().catch(console.error);

export default agent;

import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { config } from '../shared/config.js';
import type { PredictionSpec } from '../shared/types.js';

const agent = new Agent({
  port: config.ports.marketMaker,
  apiKey: config.openserv.marketMakerApiKey,
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
  description: 'Takes a natural language prediction and structures it into a formal PredictionSpec. Input should be a JSON object with "prediction" (string), optional "stakeAmount" (string, USDC), and optional "deadline" (ISO date string).',
  schema: z.object({
    prediction: z.string().describe('Natural language prediction statement'),
    stakeAmount: z.string().optional().describe('Stake amount in USDC (default: "10")'),
    deadline: z.string().optional().describe('Deadline as ISO date string'),
  }),
  async run({ args, action }) {
    const { prediction, stakeAmount = '10', deadline } = args;

    const deadlineTs = deadline
      ? Math.floor(new Date(deadline).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // default 1 week

    const spec: PredictionSpec = {
      id: uuid(),
      description: prediction,
      deadline: deadlineTs,
      stakeAmount,
      resolutionCriteria: `Determine whether the following statement is true or false as of the deadline: "${prediction}". Use publicly available information, official sources, and news reports.`,
      status: 'open',
      createdAt: Math.floor(Date.now() / 1000),
    };

    // If running within a workspace, create a task for the matchmaker
    if (action?.workspace?.id) {
      try {
        await agent.createTask({
          workspaceId: action.workspace.id,
          assignee: config.agentIds.matchmaker,
          description: `Find a counterparty for prediction: ${spec.description}`,
          body: JSON.stringify(spec),
          input: JSON.stringify(spec),
          expectedOutput: 'Matched prediction spec with both parties assigned',
          dependencies: [],
        });
      } catch (e) {
        console.error('Failed to create matchmaker task:', e);
      }
    }

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

agent.start().then(() => {
  console.log(`Market Maker agent running on port ${config.ports.marketMaker}`);
});

export default agent;

/**
 * One-time script to register 3 platform-managed jury agents on OpenServ.
 * These agents have no self-hosted code — the platform's built-in LLM handles their tasks.
 *
 * Run once from project root: cd agents && npm run jury-provision
 */
import 'dotenv/config';
import { provision, triggers } from '@openserv-labs/client';

const juryAgents = [
  {
    name: 'prediction-jury-skeptic',
    description:
      'Skeptical analyst for prediction market jury. Evaluates predictions looking for reasons they might be FALSE. Always responds with JSON containing vote and reasoning.',
    workflowName: 'Prediction Jury Skeptic',
  },
  {
    name: 'prediction-jury-optimist',
    description:
      'Optimistic analyst for prediction market jury. Evaluates predictions looking for strong evidence they are TRUE. Always responds with JSON containing vote and reasoning.',
    workflowName: 'Prediction Jury Optimist',
  },
  {
    name: 'prediction-jury-arbiter',
    description:
      'Neutral arbiter for prediction market jury. Weighs both sides equally, focuses on official verifiable sources. Always responds with JSON containing vote and reasoning.',
    workflowName: 'Prediction Jury Arbiter',
  },
];

async function main() {
  for (const a of juryAgents) {
    const result = await provision({
      agent: { name: a.name, description: a.description },
      workflow: {
        name: a.workflowName,
        goal: a.description,
        trigger: triggers.manual(),
        task: { description: `${a.name} evaluation task` },
      },
    });
    console.log(`Provisioned ${a.name}: agentId=${result.agentId}`);
  }
}

main().catch(console.error);

/**
 * Runs 3 jury agents (skeptic, optimist, arbiter) as self-hosted agents on OpenServ.
 * Each agent connects via WebSocket so the platform can dispatch tasks to them.
 * The platform's LLM handles task execution using each agent's system prompt.
 *
 * First run: calls provision() to register agents.
 * Subsequent runs: reads credentials from .openserv.json and binds directly (skips provision).
 *
 * Start via: npm run jury
 */
import 'dotenv/config';
import { Agent, run } from '@openserv-labs/sdk';
import { provision, triggers, getProvisionedInfo } from '@openserv-labs/client';

const juryConfigs = [
  {
    name: 'prediction-jury-skeptic',
    description:
      'Skeptical analyst for prediction market jury. Evaluates predictions looking for reasons they might be FALSE. Always responds with JSON containing vote and reasoning.',
    workflowName: 'Prediction Jury Skeptic',
    systemPrompt: `You are a SKEPTICAL analyst on a prediction market jury. Your job is to look for reasons a prediction might be FALSE. Be thorough and critical.

When given a prediction to evaluate, respond with ONLY valid JSON (no markdown, no explanation). Your output must be parseable JSON.

If you are the FIRST juror, output this format:
{"escrowAddress":"<address>","description":"<prediction>","deadline":"<deadline>","votes":[{"perspective":"skeptic","vote":true_or_false,"reasoning":"your detailed reasoning"}]}

If previous votes exist in the input, preserve them and add yours.

vote=true means the prediction IS true. vote=false means FALSE.`,
  },
  {
    name: 'prediction-jury-optimist',
    description:
      'Optimistic analyst for prediction market jury. Evaluates predictions looking for strong evidence they are TRUE. Always responds with JSON containing vote and reasoning.',
    workflowName: 'Prediction Jury Optimist',
    systemPrompt: `You are an OPTIMISTIC analyst on a prediction market jury. Your job is to look for strong evidence that a prediction is TRUE.

When given input containing a JSON with prediction details and existing votes, parse it. Add YOUR vote with perspective "optimist". Keep all existing votes unchanged.

Respond with ONLY the updated JSON (no markdown, no code blocks). The output must contain escrowAddress, description, deadline, and a votes array with all votes including yours.

vote=true means the prediction IS true. vote=false means FALSE.`,
  },
  {
    name: 'prediction-jury-arbiter',
    description:
      'Neutral arbiter for prediction market jury. Weighs both sides equally, focuses on official verifiable sources. Always responds with JSON containing vote and reasoning.',
    workflowName: 'Prediction Jury Arbiter',
    systemPrompt: `You are a NEUTRAL arbiter on a prediction market jury. Weigh both sides equally. Focus on official, verifiable sources.

When given input containing a JSON with prediction details and 2 existing votes, parse it. Add YOUR vote with perspective "arbiter". Keep all existing votes unchanged.

Respond with ONLY the updated JSON (no markdown, no code blocks). The output must contain escrowAddress, description, deadline, and a votes array with all 3 votes.

vote=true means the prediction IS true. vote=false means FALSE.`,
  },
];

async function startJuryAgent(config: typeof juryConfigs[0], delay: number) {
  // Stagger starts to avoid SIWE race condition
  if (delay > 0) {
    console.log(`[${config.name}] Waiting ${delay / 1000}s before start...`);
    await new Promise((r) => setTimeout(r, delay));
  }

  const agent = new Agent({ systemPrompt: config.systemPrompt });

  // Check if already provisioned — skip provision() on restart to avoid 403 conflicts
  const existing = getProvisionedInfo(config.name, config.workflowName);
  if (existing?.agentId && existing.apiKey && existing.authToken) {
    console.log(`[${config.name}] Already provisioned (agentId=${existing.agentId}), binding credentials`);
    agent.setCredentials({ apiKey: existing.apiKey, authToken: existing.authToken });
  } else {
    console.log(`[${config.name}] Not yet provisioned, registering...`);
    const result = await provision({
      agent: { instance: agent, name: config.name, description: config.description },
      workflow: {
        name: config.workflowName,
        goal: config.description,
        trigger: triggers.manual(),
        task: { description: `${config.name} evaluation task` },
      },
    });
    console.log(`[${config.name}] Provisioned (agentId=${result.agentId})`);
  }

  const runResult = await run(agent);

  const { startKeepAlive } = await import('../shared/keepalive.js');
  startKeepAlive(runResult, config.name);

  console.log(`[${config.name}] Connected and listening`);
}

async function main() {
  console.log('Starting 3 jury agents (staggered by 8s)...');
  await Promise.all(
    juryConfigs.map((config, i) => startJuryAgent(config, i * 8000)),
  );
  console.log('All jury agents running.');
}

main().catch(console.error);

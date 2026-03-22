/**
 * Sets up the multi-agent prediction market workflow on OpenServ.
 *
 * Run AFTER all 3 agents have been provisioned at least once:
 *   npx tsx src/setup-workflow.ts
 *
 * Creates a unified workflow:
 *   Webhook → Market Maker → Contract Deployer → Resolution
 */
import 'dotenv/config';
import { PlatformClient, triggers, getProvisionedInfo } from '@openserv-labs/client';

async function setup() {
  // Read agent IDs from provision state (.openserv.json)
  // getProvisionedInfo requires the exact workflow name as the second arg
  const marketMaker = getProvisionedInfo('prediction-market-maker', 'Prediction Market Maker');
  const deployer = getProvisionedInfo('prediction-deployer', 'Prediction Contract Deployer');
  const resolution = getProvisionedInfo('prediction-resolution', 'Prediction Resolution Oracle');

  if (!marketMaker?.agentId || !deployer?.agentId || !resolution?.agentId) {
    console.error('Not all agents are provisioned. Start each agent once first to register them.');
    console.error('  Status:', {
      marketMaker: marketMaker?.agentId ?? 'missing',
      deployer: deployer?.agentId ?? 'missing',
      resolution: resolution?.agentId ?? 'missing',
    });
    process.exit(1);
  }

  console.log('Agent IDs:', {
    marketMaker: marketMaker.agentId,
    deployer: deployer.agentId,
    resolution: resolution.agentId,
  });

  // Authenticate with PlatformClient
  if (!process.env.WALLET_PRIVATE_KEY) {
    console.error('Missing WALLET_PRIVATE_KEY in .env (created by first provision() call)');
    process.exit(1);
  }

  const client = new PlatformClient();
  await client.authenticate(process.env.WALLET_PRIVATE_KEY);
  console.log('Authenticated with OpenServ platform');

  // Create multi-agent workflow
  const workflow = await client.workflows.create({
    name: 'Prediction Market Pipeline',
    goal: 'End-to-end prediction market: accept a natural language prediction, match with a counterparty, deploy an escrow contract on Base with USDC deposits, and resolve the outcome via a multi-agent jury submitting to UMA Optimistic Oracle.',
    agentIds: [marketMaker.agentId, deployer.agentId, resolution.agentId],
    triggers: [
      triggers.webhook({
        name: 'webhook',
        waitForCompletion: true,
        timeout: 600,
        input: {
          prediction: {
            type: 'string',
            title: 'Prediction',
            description: 'Natural language prediction statement (e.g., "Donald Trump is still President as of March 21, 2026")',
          },
          stakeAmount: {
            type: 'string',
            title: 'Stake (USDC)',
            description: 'Stake amount in USDC (default: 1)',
          },
          deadline: {
            type: 'string',
            title: 'Deadline',
            description: 'Deadline as ISO date string (default: 1 week from now)',
          },
        },
      }),
    ],
    tasks: [
      {
        name: 'create-prediction',
        agentId: marketMaker.agentId,
        description: 'Structure prediction into formal spec',
        body: 'You MUST call the create-prediction tool with the prediction text, stakeAmount, and deadline from the webhook trigger. Pass the raw prediction text as the prediction argument. Return the tool output verbatim.',
        input: '{{trigger.prediction}}',
      },
      {
        name: 'deploy-escrow',
        agentId: deployer.agentId,
        description: 'Deploy open escrow for matching',
        body: 'You MUST call the deploy-escrow tool EXACTLY ONCE. Pass the previous task output as the prediction argument (as a JSON string). The tool deploys an open escrow contract on Base (partyNo=address(0)) and deposits USDC from the creator. Anyone can then match by depositing on-chain. Do NOT retry if it fails. Return the tool output verbatim.',
      },
      {
        name: 'resolve-outcome',
        agentId: resolution.agentId,
        description: 'Resolve prediction via jury',
        body: 'You MUST call the resolve-prediction tool. Pass the previous task output as the prediction argument (as a JSON string). The tool will run a 3-member jury and submit the resolution on-chain via UMA. Return the tool output verbatim.',
      },
    ],
    edges: [
      { from: 'trigger:webhook', to: 'task:create-prediction' },
      { from: 'task:create-prediction', to: 'task:deploy-escrow' },
      { from: 'task:deploy-escrow', to: 'task:resolve-outcome' },
    ],
  });

  // Activate workflow
  const trigger = workflow.triggers[0];
  await client.triggers.activate({ workflowId: workflow.id, id: trigger.id });
  await workflow.setRunning();

  console.log('\n========================================');
  console.log('Prediction Market Pipeline — Setup Complete');
  console.log('========================================');
  console.log(`\nWorkflow ID: ${workflow.id}`);
  console.log(`\nPipeline: Webhook → Market Maker → Deployer → Resolution`);
  console.log(`\nWebhook URL:`);
  console.log(`  POST https://api.openserv.ai/webhooks/trigger/${trigger.token}`);
  console.log(`\nExample:`);
  console.log(`  curl -X POST https://api.openserv.ai/webhooks/trigger/${trigger.token} \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"prediction": "Donald Trump is still President as of March 21, 2026", "stakeAmount": "1"}'`);
  console.log('========================================');

  // --- Jury Resolution Pipeline ---
  // Read jury agent IDs from .openserv.json (provisioned via jury-provision script)
  const skeptic = getProvisionedInfo('prediction-jury-skeptic', 'Prediction Jury Skeptic');
  const optimist = getProvisionedInfo('prediction-jury-optimist', 'Prediction Jury Optimist');
  const arbiter = getProvisionedInfo('prediction-jury-arbiter', 'Prediction Jury Arbiter');

  if (!skeptic?.agentId || !optimist?.agentId || !arbiter?.agentId) {
    console.warn('\nJury agents not provisioned yet. Skipping Jury Resolution Pipeline.');
    console.warn('Run `npm run jury-provision` first, then re-run setup-workflow.');
    return;
  }

  console.log('\nJury Agent IDs:', {
    skeptic: skeptic.agentId,
    optimist: optimist.agentId,
    arbiter: arbiter.agentId,
    resolution: resolution.agentId,
  });

  const juryWorkflow = await client.workflows.create({
    name: 'Jury Resolution Pipeline',
    goal: 'Run a 3-member jury (skeptic, optimist, arbiter) to evaluate a funded prediction, then tally votes and submit the majority outcome on-chain via resolveByJury().',
    agentIds: [skeptic.agentId, optimist.agentId, arbiter.agentId, resolution.agentId],
    triggers: [
      triggers.webhook({
        name: 'jury-webhook',
        waitForCompletion: false,
        timeout: 300,
        input: {
          escrowAddress: {
            type: 'string',
            title: 'Escrow Address',
            description: 'The escrow contract address to resolve',
          },
          description: {
            type: 'string',
            title: 'Description',
            description: 'The prediction description',
          },
          deadline: {
            type: 'string',
            title: 'Deadline',
            description: 'Prediction deadline as ISO date string',
          },
        },
      }),
    ],
    tasks: [
      {
        name: 'jury-skeptic',
        agentId: skeptic.agentId,
        description: 'Skeptical jury evaluation',
        body: `You are a SKEPTICAL analyst evaluating a prediction for a 3-member jury. Look for reasons the prediction might be FALSE. Be thorough.

Prediction: "{{trigger.description}}"
Deadline: {{trigger.deadline}}
Escrow: {{trigger.escrowAddress}}

Respond with ONLY this JSON (no markdown, no explanation):
{"escrowAddress":"{{trigger.escrowAddress}}","description":"{{trigger.description}}","deadline":"{{trigger.deadline}}","votes":[{"perspective":"skeptic","vote":true_or_false,"reasoning":"your detailed reasoning"}]}

vote=true means the prediction IS true. vote=false means FALSE.`,
        input: '{{trigger.escrowAddress}}',
      },
      {
        name: 'jury-optimist',
        agentId: optimist.agentId,
        description: 'Optimistic jury evaluation',
        body: `You are an OPTIMISTIC analyst on a 3-member jury. Look for strong evidence the prediction is TRUE.

The previous task output is a JSON with prediction details and 1 existing vote. Parse it.
Add YOUR vote with perspective "optimist". Keep existing votes unchanged.
Respond with ONLY the updated JSON (no markdown). Must contain escrowAddress, description, deadline, and votes array with both votes.`,
      },
      {
        name: 'jury-arbiter',
        agentId: arbiter.agentId,
        description: 'Neutral arbiter evaluation',
        body: `You are a NEUTRAL arbiter on a 3-member jury. Weigh both sides equally. Focus on verifiable sources.

The previous task output has 2 existing votes. Parse it.
Add YOUR vote with perspective "arbiter". Keep existing votes unchanged.
Respond with ONLY the updated JSON (no markdown). Must contain all 3 votes.`,
      },
      {
        name: 'tally-resolve',
        agentId: resolution.agentId,
        description: 'Tally jury votes and submit on-chain',
        body: 'You MUST call the tally-and-resolve tool EXACTLY ONCE. Pass the previous task output as the context argument (as a JSON string). Do NOT retry if it fails. Return the tool output verbatim.',
      },
    ],
    edges: [
      { from: 'trigger:jury-webhook', to: 'task:jury-skeptic' },
      { from: 'task:jury-skeptic', to: 'task:jury-optimist' },
      { from: 'task:jury-optimist', to: 'task:jury-arbiter' },
      { from: 'task:jury-arbiter', to: 'task:tally-resolve' },
    ],
  });

  const juryTrigger = juryWorkflow.triggers[0];
  await client.triggers.activate({ workflowId: juryWorkflow.id, id: juryTrigger.id });
  await juryWorkflow.setRunning();

  console.log('\n========================================');
  console.log('Jury Resolution Pipeline — Setup Complete');
  console.log('========================================');
  console.log(`\nWorkflow ID: ${juryWorkflow.id}`);
  console.log(`\nPipeline: Webhook → Skeptic → Optimist → Arbiter → Tally & Resolve`);
  console.log(`\nJury Webhook Token (add to JURY_WEBHOOK_TOKEN):`);
  console.log(`  ${juryTrigger.token}`);
  console.log(`\nWebhook URL:`);
  console.log(`  POST https://api.openserv.ai/webhooks/trigger/${juryTrigger.token}`);
  console.log('========================================');
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});

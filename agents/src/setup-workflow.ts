/**
 * Sets up the multi-agent prediction market workflow on OpenServ.
 *
 * Run AFTER all 4 agents have been provisioned at least once:
 *   npx tsx src/setup-workflow.ts
 *
 * Creates a unified workflow:
 *   Webhook → Market Maker → Matchmaker → Contract Deployer → Resolution
 */
import 'dotenv/config';
import { PlatformClient, triggers, getProvisionedInfo } from '@openserv-labs/client';

async function setup() {
  // Read agent IDs from provision state (.openserv.json)
  // getProvisionedInfo requires the exact workflow name as the second arg
  const marketMaker = getProvisionedInfo('prediction-market-maker', 'Prediction Market Maker');
  const matchmaker = getProvisionedInfo('prediction-matchmaker', 'Prediction Matchmaker');
  const deployer = getProvisionedInfo('prediction-deployer', 'Prediction Contract Deployer');
  const resolution = getProvisionedInfo('prediction-resolution', 'Prediction Resolution Oracle');

  if (!marketMaker?.agentId || !matchmaker?.agentId || !deployer?.agentId || !resolution?.agentId) {
    console.error('Not all agents are provisioned. Start each agent once first to register them.');
    console.error('  Status:', {
      marketMaker: marketMaker?.agentId ?? 'missing',
      matchmaker: matchmaker?.agentId ?? 'missing',
      deployer: deployer?.agentId ?? 'missing',
      resolution: resolution?.agentId ?? 'missing',
    });
    process.exit(1);
  }

  console.log('Agent IDs:', {
    marketMaker: marketMaker.agentId,
    matchmaker: matchmaker.agentId,
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
    agentIds: [marketMaker.agentId, matchmaker.agentId, deployer.agentId, resolution.agentId],
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
        name: 'match-counterparty',
        agentId: matchmaker.agentId,
        description: 'Find counterparty for prediction',
        body: 'You MUST call the match-prediction tool. Pass the previous task output as the prediction argument (as a JSON string). The tool will return the matched prediction with Ethereum addresses for partyYes and partyNo. Return the tool output verbatim.',
      },
      {
        name: 'deploy-escrow',
        agentId: deployer.agentId,
        description: 'Deploy escrow and coordinate deposits',
        body: 'You MUST call the deploy-escrow tool EXACTLY ONCE. Pass the previous task output as the prediction argument (as a JSON string). The tool deploys the escrow contract on Base, deposits USDC from both parties, and verifies funded state. Do NOT retry if it fails. Return the tool output verbatim.',
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
      { from: 'task:create-prediction', to: 'task:match-counterparty' },
      { from: 'task:match-counterparty', to: 'task:deploy-escrow' },
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
  console.log(`\nPipeline: Webhook → Market Maker → Matchmaker → Deployer → Resolution`);
  console.log(`\nWebhook URL:`);
  console.log(`  POST https://api.openserv.ai/webhooks/trigger/${trigger.token}`);
  console.log(`\nExample:`);
  console.log(`  curl -X POST https://api.openserv.ai/webhooks/trigger/${trigger.token} \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"prediction": "Donald Trump is still President as of March 21, 2026", "stakeAmount": "1"}'`);
  console.log('========================================');
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});

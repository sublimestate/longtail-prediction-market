import 'dotenv/config';
import { Agent, run } from '@openserv-labs/sdk';
import { provision, triggers } from '@openserv-labs/client';
import { z } from 'zod';
import {
  createEscrow,
  deposit,
  getEscrowState,
  getUsdcBalance,
  deployerWallet,
  getDeployerAddress,
} from '../shared/blockchain.js';
import { parsePredictionSpec, type PredictionSpec } from '../shared/types.js';
import { type Address, formatUnits } from 'viem';

// Mutex: prevent concurrent deployments (platform LLM may retry the tool)
let deployInProgress = false;

const agent = new Agent({
  systemPrompt: `You are the Contract Deployer agent for a long-tail prediction market. Your role is to:
1. Deploy open escrow contracts via the factory on Base (partyNo = address(0) for open matching)
2. Deposit USDC from the creator (partyYes)
3. The escrow stays in Created state until a counterparty matches on-chain
4. Forward deployed escrows to the Resolution agent

You never write or modify Solidity code — you only provide deployment parameters to the audited factory contract.`,
});

agent.addCapability({
  name: 'deploy-escrow',
  description:
    'Deploys an escrow contract for a matched prediction. Input is the matched prediction spec JSON.',
  schema: z.object({
    prediction: z.string().describe('JSON string of the matched PredictionSpec'),
  }),
  async run({ args }) {
    // Prevent concurrent deployments (nonce race from platform retries)
    if (deployInProgress) {
      return 'Error: A deployment is already in progress. Do NOT retry — wait for it to complete.';
    }

    let spec: PredictionSpec;
    try {
      spec = parsePredictionSpec(args.prediction);
    } catch (e) {
      return `Error: Invalid prediction JSON — ${e}`;
    }

    if (!process.env.FACTORY_ADDRESS) {
      return 'Error: FACTORY_ADDRESS not set in environment. Deploy the factory contract first.';
    }

    // Use deployer wallet as partyYes; partyNo = address(0) for open matching
    const deployerAddr = getDeployerAddress();
    const partyYesAddr = spec.partyYes?.address || deployerAddr;
    const partyNoAddr = '0x0000000000000000000000000000000000000000'; // open for matching

    // Pre-flight: check creator's USDC balance
    const { parseUnits } = await import('viem');
    const requiredAmount = parseUnits(spec.stakeAmount, 6);

    if (partyYesAddr.toLowerCase() === deployerAddr.toLowerCase()) {
      const balance = await getUsdcBalance(deployerAddr);
      if (balance < requiredAmount) {
        return `Error: Deployer wallet has insufficient USDC. Has ${formatUnits(balance, 6)}, needs ${spec.stakeAmount}. Fund ${deployerAddr} before retrying.`;
      }
    }

    deployInProgress = true;
    try {
      // 1. Deploy open escrow via factory (partyNo = address(0))
      console.log('Deploying open escrow contract...');
      const escrowAddress = await createEscrow(
        partyYesAddr as Address,
        partyNoAddr as Address,
        spec.stakeAmount,
        spec.deadline,
        spec.description,
      );

      spec.escrowAddress = escrowAddress;
      console.log(`Open escrow deployed at: ${escrowAddress}`);

      // 2. Deposit from partyYes (creator)
      if (partyYesAddr.toLowerCase() === deployerAddr.toLowerCase()) {
        console.log('Depositing from creator (partyYes)...');
        await deposit(escrowAddress, deployerWallet, spec.stakeAmount);
      }

      // 3. Verify state — stays Created until a counterparty matches
      const state = await getEscrowState(escrowAddress);

      return `Open escrow deployed successfully:\n\`\`\`json\n${JSON.stringify(
        {
          escrowAddress,
          partyYes: partyYesAddr,
          partyNo: 'open — waiting for counterparty to match',
          stakeAmount: spec.stakeAmount,
          state: state.state,
          deadline: spec.deadline > 0 ? new Date(spec.deadline * 1000).toISOString() : 'unknown',
        },
        null,
        2,
      )}\n\`\`\`\n\nEscrow is open for matching. Anyone can deposit to claim the NO side.`;
    } catch (e) {
      return `Error deploying escrow: ${e}`;
    } finally {
      deployInProgress = false;
    }
  },
});

agent.addCapability({
  name: 'check-escrow-status',
  description: 'Checks the on-chain state of an escrow contract. Input is the escrow address.',
  schema: z.object({
    escrowAddress: z.string().describe('The escrow contract address'),
  }),
  async run({ args }) {
    try {
      const state = await getEscrowState(args.escrowAddress as Address);
      return `Escrow state:\n\`\`\`json\n${JSON.stringify(
        {
          address: args.escrowAddress,
          state: state.state,
          partyYes: state.partyYes,
          partyNo: state.partyNo,
          stakeAmount: state.stakeAmount.toString(),
          deadline: new Date(Number(state.deadline) * 1000).toISOString(),
          description: state.description,
          assertionId: state.assertionId,
          resolvedYes: state.resolvedYes,
        },
        null,
        2,
      )}\n\`\`\``;
    } catch (e) {
      return `Error reading escrow state: ${e}`;
    }
  },
});

async function main() {
  const result = await provision({
    agent: {
      instance: agent,
      name: 'prediction-deployer',
      description:
        'Deploys escrow contracts via the factory on Base, coordinates USDC deposits from both parties, and verifies the escrow reaches Funded state.',
    },
    workflow: {
      name: 'Prediction Contract Deployer',
      goal: 'Deploy per-prediction escrow contracts on Base using the audited factory pattern, coordinate USDC approvals and deposits from both parties, verify funded state, then forward to resolution agent.',
      trigger: triggers.manual(),
      task: { description: 'Deploy and fund escrow contract' },
    },
  });

  console.log(`Contract Deployer provisioned (agent ID: ${result.agentId})`);
  await run(agent);
}

main().catch(console.error);

export default agent;

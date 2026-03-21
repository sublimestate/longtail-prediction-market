import 'dotenv/config';
import { Agent, run } from '@openserv-labs/sdk';
import { provision, triggers } from '@openserv-labs/client';
import { z } from 'zod';
import {
  createEscrow,
  deposit,
  getEscrowState,
  deployerWallet,
  counterpartyWallet,
  getDeployerAddress,
  getCounterpartyAddress,
} from '../shared/blockchain.js';
import { parsePredictionSpec, type PredictionSpec } from '../shared/types.js';
import type { Address } from 'viem';

const agent = new Agent({
  systemPrompt: `You are the Contract Deployer agent for a long-tail prediction market. Your role is to:
1. Deploy escrow contracts via the factory on Base
2. Coordinate USDC approvals and deposits from both parties
3. Verify the escrow reaches the Funded state
4. Forward funded escrows to the Resolution agent

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
    let spec: PredictionSpec;
    try {
      spec = parsePredictionSpec(args.prediction);
    } catch (e) {
      return `Error: Invalid prediction JSON — ${e}`;
    }

    if (!spec.partyYes?.address || !spec.partyNo?.address) {
      return 'Error: Prediction must be matched with both parties before deploying escrow.';
    }

    if (!process.env.FACTORY_ADDRESS) {
      return 'Error: FACTORY_ADDRESS not set in environment. Deploy the factory contract first.';
    }

    try {
      // 1. Deploy escrow via factory
      console.log('Deploying escrow contract...');
      const escrowAddress = await createEscrow(
        spec.partyYes.address as Address,
        spec.partyNo.address as Address,
        spec.stakeAmount,
        spec.deadline,
        spec.description,
      );

      spec.escrowAddress = escrowAddress;
      console.log(`Escrow deployed at: ${escrowAddress}`);

      // 2. Deposit from partyYes (deployer)
      console.log('Depositing from partyYes...');
      const deployerAddr = getDeployerAddress();
      if (spec.partyYes.address.toLowerCase() === deployerAddr.toLowerCase()) {
        await deposit(escrowAddress, deployerWallet, spec.stakeAmount);
      }

      // 3. Deposit from partyNo (counterparty)
      console.log('Depositing from partyNo...');
      const counterpartyAddr = getCounterpartyAddress();
      if (spec.partyNo.address.toLowerCase() === counterpartyAddr.toLowerCase()) {
        await deposit(escrowAddress, counterpartyWallet, spec.stakeAmount);
      }

      // 4. Verify funded state
      const state = await getEscrowState(escrowAddress);
      spec.status = state.state === 'Funded' ? 'funded' : spec.status;

      return `Escrow deployed and funded successfully:\n\`\`\`json\n${JSON.stringify(
        {
          escrowAddress,
          partyYes: spec.partyYes.address,
          partyNo: spec.partyNo.address,
          stakeAmount: spec.stakeAmount,
          state: state.state,
          deadline: spec.deadline > 0 ? new Date(spec.deadline * 1000).toISOString() : 'unknown',
        },
        null,
        2,
      )}\n\`\`\`\n\nForwarded to Resolution agent for monitoring.`;
    } catch (e) {
      return `Error deploying escrow: ${e}`;
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

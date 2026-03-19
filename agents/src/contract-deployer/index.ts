import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import { config } from '../shared/config.js';
import {
  createEscrow,
  deposit,
  getEscrowState,
  deployerWallet,
  counterpartyWallet,
  getDeployerAddress,
  getCounterpartyAddress,
} from '../shared/blockchain.js';
import type { PredictionSpec } from '../shared/types.js';
import type { Address } from 'viem';

const agent = new Agent({
  port: config.ports.deployer,
  apiKey: config.openserv.deployerApiKey,
  systemPrompt: `You are the Contract Deployer agent for a long-tail prediction market. Your role is to:
1. Deploy escrow contracts via the factory on Base
2. Coordinate USDC approvals and deposits from both parties
3. Verify the escrow reaches the Funded state
4. Forward funded escrows to the Resolution agent

You never write or modify Solidity code — you only provide deployment parameters to the audited factory contract.`,
});

agent.addCapability({
  name: 'deploy-escrow',
  description: 'Deploys an escrow contract for a matched prediction. Input is the matched prediction spec JSON.',
  schema: z.object({
    prediction: z.string().describe('JSON string of the matched PredictionSpec'),
  }),
  async run({ args, action }) {
    let spec: PredictionSpec;
    try {
      spec = JSON.parse(args.prediction);
    } catch {
      return 'Error: Invalid prediction JSON';
    }

    if (!spec.partyYes?.address || !spec.partyNo?.address) {
      return 'Error: Prediction must be matched with both parties before deploying escrow.';
    }

    if (!config.blockchain.factoryAddress) {
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

      // 5. Create task for resolution agent
      if (action?.workspace?.id && state.state === 'Funded') {
        try {
          await agent.createTask({
            workspaceId: action.workspace.id,
            assignee: config.agentIds.resolution,
            description: `Monitor and resolve prediction: ${spec.description}`,
            body: JSON.stringify(spec),
            input: JSON.stringify(spec),
            expectedOutput: 'Resolution submitted on-chain with jury verdict',
            dependencies: [],
          });
        } catch (e) {
          console.error('Failed to create resolution task:', e);
        }
      }

      return `Escrow deployed and funded successfully:\n\`\`\`json\n${JSON.stringify(
        {
          escrowAddress,
          partyYes: spec.partyYes.address,
          partyNo: spec.partyNo.address,
          stakeAmount: spec.stakeAmount,
          state: state.state,
          deadline: new Date(spec.deadline * 1000).toISOString(),
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

agent.start().then(() => {
  console.log(`Contract Deployer agent running on port ${config.ports.deployer}`);
});

export default agent;

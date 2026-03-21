import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { sepolia, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { publicActionsL1, walletActionsL1 } from 'viem/op-stack';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY not set');

const account = privateKeyToAccount(privateKey);

const l1Client = createWalletClient({
  account,
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
}).extend(walletActionsL1());

const l1Public = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
}).extend(publicActionsL1());

const l2Public = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

async function main() {
  const l1Balance = await l1Public.getBalance({ address: account.address });
  const l2Balance = await l2Public.getBalance({ address: account.address });

  console.log(`Address: ${account.address}`);
  console.log(`Sepolia balance: ${formatEther(l1Balance)} ETH`);
  console.log(`Base Sepolia balance: ${formatEther(l2Balance)} ETH`);

  // Bridge 80% of L1 balance (keep some for gas)
  const gasReserve = parseEther('0.001');
  if (l1Balance <= gasReserve) {
    console.error('Not enough Sepolia ETH to bridge');
    process.exit(1);
  }

  const bridgeAmount = l1Balance - gasReserve;
  console.log(`\nBridging ${formatEther(bridgeAmount)} ETH to Base Sepolia...`);

  const hash = await l1Client.depositTransaction({
    request: {
      gas: 21000n,
      to: account.address,
      value: bridgeAmount,
    },
    targetChain: baseSepolia,
  });

  console.log(`L1 tx: ${hash}`);
  console.log('Waiting for L1 confirmation...');

  const receipt = await l1Public.waitForTransactionReceipt({ hash });
  console.log(`L1 confirmed in block ${receipt.blockNumber}`);
  console.log('\nDeposit submitted. Base Sepolia funds should arrive in ~1-2 minutes.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

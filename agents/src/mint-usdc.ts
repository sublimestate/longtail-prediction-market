import { createPublicClient, createWalletClient, http, parseAbi, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const counterpartyKey = process.env.COUNTERPARTY_PRIVATE_KEY as `0x${string}`;

const deployer = privateKeyToAccount(deployerKey);
const counterparty = privateKeyToAccount(counterpartyKey);

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function mint(address to, uint256 amount) external',
  'function masterMinter() view returns (address)',
  'function configureMinter(address minter, uint256 minterAllowedAmount) external',
]);

async function main() {
  const [name, symbol, decimals] = await Promise.all([
    client.readContract({ address: USDC, abi, functionName: 'name' }),
    client.readContract({ address: USDC, abi, functionName: 'symbol' }),
    client.readContract({ address: USDC, abi, functionName: 'decimals' }),
  ]);
  console.log(`Token: ${name} (${symbol}), decimals: ${decimals}`);

  const [deployerBal, counterpartyBal] = await Promise.all([
    client.readContract({ address: USDC, abi, functionName: 'balanceOf', args: [deployer.address] }),
    client.readContract({ address: USDC, abi, functionName: 'balanceOf', args: [counterparty.address] }),
  ]);
  console.log(`Deployer (${deployer.address}): ${formatUnits(deployerBal, Number(decimals))} ${symbol}`);
  console.log(`Counterparty (${counterparty.address}): ${formatUnits(counterpartyBal, Number(decimals))} ${symbol}`);

  // Try to mint
  const wallet = createWalletClient({
    account: deployer,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
  });

  try {
    console.log('\nAttempting to mint 100 USDC to deployer...');
    const hash = await wallet.writeContract({
      address: USDC,
      abi,
      functionName: 'mint',
      args: [deployer.address, 100_000_000n], // 100 USDC
      chain: baseSepolia,
    });
    console.log(`Mint tx: ${hash}`);
    await client.waitForTransactionReceipt({ hash });
    console.log('Mint successful!');
  } catch (e: any) {
    console.log(`Mint failed: ${e.message?.slice(0, 200)}`);
    console.log('\nThis USDC contract requires minter authorization.');
    console.log('Get testnet USDC from: https://faucet.circle.com (select Base Sepolia)');
  }
}

main().catch(console.error);

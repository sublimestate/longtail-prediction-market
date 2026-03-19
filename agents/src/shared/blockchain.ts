import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  parseUnits,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from './config.js';

// ABIs
export const escrowFactoryAbi = parseAbi([
  'function createEscrow(address partyYes, address partyNo, uint256 stakeAmount, uint256 deadline, string description) external returns (address)',
  'function getEscrowCount() external view returns (uint256)',
  'function getEscrow(uint256 index) external view returns (address)',
  'event EscrowCreated(address indexed escrow, address indexed partyYes, address indexed partyNo, uint256 stakeAmount, uint256 deadline, string description)',
]);

export const predictionEscrowAbi = parseAbi([
  'function deposit() external',
  'function initiateResolution(bytes claim, bool _outcomeYes) external',
  'function expire() external',
  'function state() external view returns (uint8)',
  'function partyYes() external view returns (address)',
  'function partyNo() external view returns (address)',
  'function stakeAmount() external view returns (uint256)',
  'function deadline() external view returns (uint256)',
  'function description() external view returns (string)',
  'function assertionId() external view returns (bytes32)',
  'function resolvedYes() external view returns (bool)',
  'event Deposited(address indexed party, uint256 amount)',
  'event ResolutionInitiated(bytes32 indexed assertionId, bool proposedOutcome)',
  'event Settled(bool resolvedYes, address winner)',
]);

export const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
]);

// State enum mapping
export const EscrowState = {
  0: 'Created',
  1: 'Funded',
  2: 'Resolving',
  3: 'Settled',
  4: 'Expired',
} as const;

// Clients
const deployerAccount = privateKeyToAccount(config.blockchain.deployerPrivateKey);
const counterpartyAccount = privateKeyToAccount(config.blockchain.counterpartyPrivateKey);

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(config.blockchain.baseSepoliaRpcUrl),
});

export const deployerWallet = createWalletClient({
  account: deployerAccount,
  chain: baseSepolia,
  transport: http(config.blockchain.baseSepoliaRpcUrl),
});

export const counterpartyWallet = createWalletClient({
  account: counterpartyAccount,
  chain: baseSepolia,
  transport: http(config.blockchain.baseSepoliaRpcUrl),
});

export function getDeployerAddress(): Address {
  return deployerAccount.address;
}

export function getCounterpartyAddress(): Address {
  return counterpartyAccount.address;
}

// Contract interaction helpers

export async function createEscrow(
  partyYes: Address,
  partyNo: Address,
  stakeAmount: string,
  deadline: number,
  description: string,
): Promise<Address> {
  const factoryAddress = config.blockchain.factoryAddress;
  if (!factoryAddress) throw new Error('FACTORY_ADDRESS not set');

  const stakeWei = parseUnits(stakeAmount, 6);

  const hash = await deployerWallet.writeContract({
    address: factoryAddress,
    abi: escrowFactoryAbi,
    functionName: 'createEscrow',
    args: [partyYes, partyNo, stakeWei, BigInt(deadline), description],
    chain: baseSepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Fallback: query factory for latest escrow
  const count = await publicClient.readContract({
    address: factoryAddress,
    abi: escrowFactoryAbi,
    functionName: 'getEscrowCount',
  });
  const escrowAddr = await publicClient.readContract({
    address: factoryAddress,
    abi: escrowFactoryAbi,
    functionName: 'getEscrow',
    args: [count - 1n],
  });
  return escrowAddr as Address;
}

export async function deposit(
  escrowAddress: Address,
  wallet: typeof deployerWallet,
  stakeAmount: string,
): Promise<string> {
  const usdcAddress = config.contracts.usdcBaseSepolia;
  const stakeWei = parseUnits(stakeAmount, 6);

  // Approve USDC
  const approveHash = await wallet.writeContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [escrowAddress, stakeWei],
    chain: baseSepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // Deposit
  const depositHash = await wallet.writeContract({
    address: escrowAddress,
    abi: predictionEscrowAbi,
    functionName: 'deposit',
    chain: baseSepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });

  return depositHash;
}

export async function initiateResolution(
  escrowAddress: Address,
  claim: string,
  outcomeYes: boolean,
): Promise<string> {
  const claimBytes = new TextEncoder().encode(claim);

  const hash = await deployerWallet.writeContract({
    address: escrowAddress,
    abi: predictionEscrowAbi,
    functionName: 'initiateResolution',
    args: [`0x${Buffer.from(claimBytes).toString('hex')}`, outcomeYes],
    chain: baseSepolia,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function getEscrowState(escrowAddress: Address): Promise<{
  state: string;
  partyYes: Address;
  partyNo: Address;
  stakeAmount: bigint;
  deadline: bigint;
  description: string;
  assertionId: `0x${string}`;
  resolvedYes: boolean;
}> {
  const [state, partyYes, partyNo, stakeAmount, deadline, description, assertionId, resolvedYes] =
    await Promise.all([
      publicClient.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'state' }),
      publicClient.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyYes' }),
      publicClient.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyNo' }),
      publicClient.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'stakeAmount' }),
      publicClient.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'deadline' }),
      publicClient.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'description' }),
      publicClient.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'assertionId' }),
      publicClient.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'resolvedYes' }),
    ]);

  return {
    state: EscrowState[state as keyof typeof EscrowState] || 'Unknown',
    partyYes: partyYes as Address,
    partyNo: partyNo as Address,
    stakeAmount: stakeAmount as bigint,
    deadline: deadline as bigint,
    description: description as string,
    assertionId: assertionId as `0x${string}`,
    resolvedYes: resolvedYes as boolean,
  };
}

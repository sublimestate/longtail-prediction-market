import { createPublicClient, http, parseAbi, formatUnits, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { Prediction, EscrowState } from './types';

const ESCROW_STATE_MAP: Record<number, EscrowState> = {
  0: 'Created',
  1: 'Funded',
  2: 'Resolving',
  3: 'Settled',
  4: 'Expired',
};

const escrowFactoryAbi = parseAbi([
  'function getEscrowCount() external view returns (uint256)',
  'function getEscrow(uint256 index) external view returns (address)',
]);

const predictionEscrowAbi = parseAbi([
  'function state() external view returns (uint8)',
  'function partyYes() external view returns (address)',
  'function partyNo() external view returns (address)',
  'function stakeAmount() external view returns (uint256)',
  'function deadline() external view returns (uint256)',
  'function description() external view returns (string)',
  'function assertionId() external view returns (bytes32)',
  'function resolvedYes() external view returns (bool)',
]);

function getClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
  });
}

function getFactoryAddress(): Address {
  const addr = process.env.FACTORY_ADDRESS;
  if (!addr) throw new Error('FACTORY_ADDRESS not set');
  return addr as Address;
}

export async function getEscrowState(escrowAddress: Address): Promise<Prediction> {
  const client = getClient();
  const [state, partyYes, partyNo, stakeAmount, deadline, description, assertionId, resolvedYes] =
    await Promise.all([
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'state' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyYes' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyNo' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'stakeAmount' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'deadline' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'description' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'assertionId' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'resolvedYes' }),
    ]);

  return {
    escrowAddress,
    description: description as string,
    state: ESCROW_STATE_MAP[state as number] || 'Created',
    stakeAmount: formatUnits(stakeAmount as bigint, 6),
    deadline: Number(deadline),
    partyYes: partyYes as string,
    partyNo: partyNo as string,
    assertionId: assertionId as string,
    resolvedYes: resolvedYes as boolean,
  };
}

export async function getAllPredictions(): Promise<Prediction[]> {
  const client = getClient();
  const factory = getFactoryAddress();

  const count = await client.readContract({
    address: factory,
    abi: escrowFactoryAbi,
    functionName: 'getEscrowCount',
  });

  const n = Number(count);
  if (n === 0) return [];

  const addresses = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      client.readContract({
        address: factory,
        abi: escrowFactoryAbi,
        functionName: 'getEscrow',
        args: [BigInt(i)],
      })
    )
  );

  const predictions = await Promise.all(
    addresses.map((addr) => getEscrowState(addr as Address))
  );

  return predictions;
}

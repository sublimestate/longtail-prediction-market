import { createPublicClient, http, parseAbi, formatUnits, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { Prediction, EscrowState } from './types';

const ESCROW_STATE_MAP: Record<number, EscrowState> = {
  0: 'Created',
  1: 'Funded',
  2: 'Resolving',
  3: 'Settled',
  4: 'Expired',
  5: 'JuryResolving',
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
  'function challengeWindow() external view returns (uint64)',
  'function description() external view returns (string)',
  'function assertionId() external view returns (bytes32)',
  'function resolvedYes() external view returns (bool)',
  'function partyYesDeposited() external view returns (bool)',
  'function partyNoDeposited() external view returns (bool)',
  'function juryOutcomeYes() external view returns (bool)',
  'function juryDeadline() external view returns (uint256)',
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
  const [state, partyYes, partyNo, stakeAmount, deadline, challengeWindow, description, assertionId, resolvedYes, partyYesDeposited, partyNoDeposited, juryOutcomeYes, juryDeadline] =
    await Promise.all([
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'state' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyYes' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyNo' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'stakeAmount' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'deadline' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'challengeWindow' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'description' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'assertionId' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'resolvedYes' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyYesDeposited' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'partyNoDeposited' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'juryOutcomeYes' }),
      client.readContract({ address: escrowAddress, abi: predictionEscrowAbi, functionName: 'juryDeadline' }),
    ]);

  return {
    escrowAddress,
    description: description as string,
    state: ESCROW_STATE_MAP[state as number] || 'Created',
    stakeAmount: formatUnits(stakeAmount as bigint, 6),
    deadline: Number(deadline),
    challengeWindow: Number(challengeWindow),
    partyYes: partyYes as string,
    partyNo: partyNo as string,
    partyYesDeposited: partyYesDeposited as boolean,
    partyNoDeposited: partyNoDeposited as boolean,
    assertionId: assertionId as string,
    resolvedYes: resolvedYes as boolean,
    juryOutcomeYes: juryOutcomeYes as boolean,
    juryDeadline: Number(juryDeadline),
  };
}

const ESCROW_FIELDS = [
  'state', 'partyYes', 'partyNo', 'stakeAmount',
  'deadline', 'challengeWindow', 'description', 'assertionId', 'resolvedYes',
  'partyYesDeposited', 'partyNoDeposited', 'juryOutcomeYes', 'juryDeadline',
] as const;

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

  // Batch all address lookups into one multicall
  const addressResults = await client.multicall({
    contracts: Array.from({ length: n }, (_, i) => ({
      address: factory,
      abi: escrowFactoryAbi,
      functionName: 'getEscrow' as const,
      args: [BigInt(i)],
    })),
  });

  const addresses = addressResults
    .filter((r) => r.status === 'success')
    .map((r) => r.result as Address);

  if (addresses.length === 0) return [];

  // Batch all escrow state reads into one multicall (8 fields per escrow)
  const stateResults = await client.multicall({
    contracts: addresses.flatMap((addr) =>
      ESCROW_FIELDS.map((fn) => ({
        address: addr,
        abi: predictionEscrowAbi,
        functionName: fn,
      }))
    ),
  });

  const predictions: Prediction[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const offset = i * ESCROW_FIELDS.length;
    const vals = stateResults.slice(offset, offset + ESCROW_FIELDS.length);
    if (vals.some((v) => v.status === 'failure')) continue;

    predictions.push({
      escrowAddress: addresses[i],
      state: ESCROW_STATE_MAP[vals[0].result as number] || 'Created',
      partyYes: vals[1].result as string,
      partyNo: vals[2].result as string,
      stakeAmount: formatUnits(vals[3].result as bigint, 6),
      deadline: Number(vals[4].result),
      challengeWindow: Number(vals[5].result),
      description: vals[6].result as string,
      assertionId: vals[7].result as string,
      resolvedYes: vals[8].result as boolean,
      partyYesDeposited: vals[9].result as boolean,
      partyNoDeposited: vals[10].result as boolean,
      juryOutcomeYes: vals[11].result as boolean,
      juryDeadline: Number(vals[12].result),
    });
  }

  return predictions;
}

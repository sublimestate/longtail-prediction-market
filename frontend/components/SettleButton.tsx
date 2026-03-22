'use client';

import { useAccount, useWriteContract } from 'wagmi';
import { parseAbi, type Hex } from 'viem';

const OOV3_ADDRESS = '0x0F7fC5E6482f096380db6158f978167b57388deE' as const;
const abi = parseAbi(['function settleAssertion(bytes32 assertionId) external']);

export function SettleButton({
  assertionId,
  escrowAddress,
}: {
  assertionId: string;
  escrowAddress: string;
}) {
  const { isConnected } = useAccount();
  const { writeContract, data: txHash, isPending, isSuccess, isError, error } = useWriteContract();

  if (!isConnected) {
    return (
      <p className="text-xs text-gray-500 mt-2">Connect wallet to settle</p>
    );
  }

  return (
    <div className="mt-3">
      {!isSuccess && (
        <button
          onClick={() =>
            writeContract({
              address: OOV3_ADDRESS,
              abi,
              functionName: 'settleAssertion',
              args: [assertionId as Hex],
            })
          }
          disabled={isPending}
          className="px-4 py-2 bg-status-settled/20 border border-status-settled/40 hover:bg-status-settled/30 disabled:opacity-50 rounded-lg text-sm text-status-settled font-medium transition-colors"
        >
          {isPending ? 'Settling...' : 'Settle Assertion'}
        </button>
      )}
      {isSuccess && txHash && (
        <p className="text-xs text-status-settled mt-1">
          Settled!{' '}
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            View tx
          </a>
        </p>
      )}
      {isError && (
        <p className="text-xs text-red-400 mt-1">
          {error?.message?.split('\n')[0] || 'Settlement failed'}
        </p>
      )}
    </div>
  );
}

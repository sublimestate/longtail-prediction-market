'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseAbi, type Address } from 'viem';

const abi = parseAbi(['function settleJuryResolution() external']);

export function SettleJuryButton({ escrowAddress }: { escrowAddress: string }) {
  const { isConnected } = useAccount();
  const { writeContract, data: txHash, isPending, isSuccess, isError, error } = useWriteContract();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !isConnected) {
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
              address: escrowAddress as Address,
              abi,
              functionName: 'settleJuryResolution',
            })
          }
          disabled={isPending}
          className="px-4 py-2 bg-status-settled/20 border border-status-settled/40 hover:bg-status-settled/30 disabled:opacity-50 rounded-lg text-sm text-status-settled font-medium transition-colors"
        >
          {isPending ? 'Settling...' : 'Settle Jury Resolution'}
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

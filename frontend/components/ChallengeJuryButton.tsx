'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseAbi, type Address } from 'viem';

const abi = parseAbi(['function challengeJuryResolution() external']);

export function ChallengeJuryButton({ escrowAddress }: { escrowAddress: string }) {
  const { isConnected } = useAccount();
  const { writeContract, data: txHash, isPending, isSuccess, isError, error } = useWriteContract();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !isConnected) {
    return (
      <p className="text-xs text-gray-500 mt-2">Connect wallet to challenge</p>
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
              functionName: 'challengeJuryResolution',
            })
          }
          disabled={isPending}
          className="px-4 py-2 bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50 rounded-lg text-sm text-red-400 font-medium transition-colors"
        >
          {isPending ? 'Challenging...' : 'Challenge → Escalate to UMA'}
        </button>
      )}
      {isSuccess && txHash && (
        <p className="text-xs text-yellow-400 mt-1">
          Challenged! Escrow reset to Funded — resolution will use UMA.{' '}
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
          {error?.message?.split('\n')[0] || 'Challenge failed'}
        </p>
      )}
    </div>
  );
}

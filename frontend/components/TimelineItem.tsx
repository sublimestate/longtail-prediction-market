import Link from 'next/link';
import type { Prediction } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { CountdownTimer } from './CountdownTimer';

const DOT_COLORS: Record<string, string> = {
  Created: 'bg-status-created',
  Funded: 'bg-status-funded',
  Resolving: 'bg-status-resolving',
  Settled: 'bg-status-settled',
  Expired: 'bg-status-expired',
  JuryResolving: 'bg-yellow-500',
};

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function TimelineItem({ prediction }: { prediction: Prediction }) {
  const { escrowAddress, description, state, stakeAmount, deadline, resolvedYes, partyNo } = prediction;
  const isOpen = state === 'Created' && partyNo === '0x0000000000000000000000000000000000000000';

  return (
    <div className="relative pl-6">
      <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${DOT_COLORS[state] || 'bg-gray-500'}`} />
      <Link href={`/prediction/${escrowAddress}`} className="block bg-navy-800 border border-navy-700/50 rounded-lg p-4 hover:border-gray-600 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <p className="text-white text-sm font-medium flex-1 mr-4">{description || 'Untitled prediction'}</p>
          <div className="flex items-center gap-2">
            {isOpen && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                OPEN
              </span>
            )}
            <StatusBadge state={state} />
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="font-mono">{truncateAddress(escrowAddress)}</span>
          {state === 'Settled' && (
            <span className="text-status-settled">Outcome: {resolvedYes ? 'YES' : 'NO'}</span>
          )}
          {(state === 'Created' || state === 'Funded') && (
            <CountdownTimer targetTimestamp={deadline} />
          )}
          {state === 'JuryResolving' && (
            <span className="text-yellow-400">Jury challenge window active</span>
          )}
          {state === 'Resolving' && (
            <span className="text-status-resolving">UMA dispute window active</span>
          )}
          <span className="bg-navy-900 border border-navy-700 rounded-full px-2 py-0.5 text-xs text-gray-300 ml-auto">
            {state === 'Created' ? `Stake: ${stakeAmount} USDC` : `Pool: ${parseFloat(stakeAmount) * 2} USDC`}
          </span>
        </div>
      </Link>
    </div>
  );
}

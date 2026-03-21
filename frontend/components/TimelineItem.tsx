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
};

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function TimelineItem({ prediction }: { prediction: Prediction }) {
  const { escrowAddress, description, state, stakeAmount, deadline, resolvedYes } = prediction;

  return (
    <div className="relative pl-6">
      <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${DOT_COLORS[state] || 'bg-gray-500'}`} />
      <Link href={`/prediction/${escrowAddress}`} className="block bg-navy-800 border border-navy-700/50 rounded-lg p-4 hover:border-gray-600 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <p className="text-white text-sm font-medium flex-1 mr-4">{description || 'Untitled prediction'}</p>
          <StatusBadge state={state} />
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{stakeAmount} USDC</span>
          <span className="font-mono">{truncateAddress(escrowAddress)}</span>
          {state === 'Settled' && (
            <span className="text-status-settled">Outcome: {resolvedYes ? 'YES' : 'NO'}</span>
          )}
          {(state === 'Created' || state === 'Funded') && (
            <CountdownTimer targetTimestamp={deadline} />
          )}
          {state === 'Resolving' && (
            <span className="text-status-resolving">UMA dispute window active</span>
          )}
        </div>
      </Link>
    </div>
  );
}

import type { EscrowState } from '@/lib/types';

const STATUS_STYLES: Record<EscrowState, string> = {
  Created: 'bg-status-created/20 text-status-created',
  Funded: 'bg-status-funded/20 text-status-funded',
  Resolving: 'bg-status-resolving/20 text-status-resolving',
  Settled: 'bg-status-settled/20 text-status-settled',
  Expired: 'bg-status-expired/20 text-status-expired',
  JuryResolving: 'bg-yellow-500/20 text-yellow-400',
};

export function StatusBadge({ state }: { state: EscrowState }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[state]}`}>
      {state.toUpperCase()}
    </span>
  );
}

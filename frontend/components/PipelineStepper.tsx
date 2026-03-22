import type { EscrowState } from '@/lib/types';

const STEPS: EscrowState[] = ['Created', 'Funded', 'Resolving', 'Settled'];

const STEP_INDEX: Record<EscrowState, number> = {
  Created: 0,
  Funded: 1,
  Resolving: 2,
  JuryResolving: 2,
  Settled: 3,
  Expired: -1,
};

export function PipelineStepper({ current }: { current: EscrowState }) {
  const currentIdx = STEP_INDEX[current];

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 ${
                  done
                    ? 'bg-status-settled border-status-settled text-black'
                    : active
                      ? 'border-purple-500 text-purple-400'
                      : 'border-navy-700 text-gray-600'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 ${active ? 'text-white' : 'text-gray-500'}`}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${done ? 'bg-status-settled' : 'bg-navy-700'}`} />
            )}
          </div>
        );
      })}
      {current === 'Expired' && (
        <span className="ml-4 text-status-expired text-xs font-medium">EXPIRED</span>
      )}
    </div>
  );
}

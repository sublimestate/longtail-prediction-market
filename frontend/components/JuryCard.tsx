import type { JuryVote } from '@/lib/types';

export function JuryCard({ vote }: { vote: JuryVote }) {
  return (
    <div className="bg-navy-900 border border-navy-700 rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-gray-400 uppercase">{vote.role}</span>
        <span className={`text-xs font-bold ${vote.vote ? 'text-status-settled' : 'text-red-400'}`}>
          {vote.vote ? 'YES' : 'NO'}
        </span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{vote.reasoning}</p>
    </div>
  );
}

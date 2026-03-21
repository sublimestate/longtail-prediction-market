import type { Prediction } from '@/lib/types';
import { TimelineItem } from './TimelineItem';

export function Timeline({ predictions }: { predictions: Prediction[] }) {
  if (predictions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No predictions yet. Submit one to get started.
      </div>
    );
  }

  return (
    <div className="border-l-2 border-navy-700 ml-1.5 space-y-4">
      {predictions.map((p) => (
        <TimelineItem key={p.escrowAddress} prediction={p} />
      ))}
    </div>
  );
}

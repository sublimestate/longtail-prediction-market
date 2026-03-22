'use client';

import { useState, useEffect } from 'react';
import type { Prediction, EscrowState } from '@/lib/types';
import { Timeline } from './Timeline';
import { NewPredictionModal } from './NewPredictionModal';
import { ConnectButton } from './ConnectButton';

const FILTERS: (EscrowState | 'All')[] = ['All', 'Created', 'Funded', 'Resolving', 'Settled'];

export function HomeClient({ initial }: { initial: Prediction[] }) {
  const [predictions, setPredictions] = useState(initial);
  const [filter, setFilter] = useState<EscrowState | 'All'>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const resp = await fetch('/api/predictions');
        const data = await resp.json();
        if (data.predictions) {
          setPredictions(data.predictions);
          setFetchError(null);
        }
      } catch {
        setFetchError('Failed to refresh. Showing cached data.');
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'All' ? predictions : predictions.filter((p) => p.state === filter);

  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white">Prediction Market</h1>
        <div className="flex items-center gap-3">
          <ConnectButton />
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white font-medium"
          >
            + New Prediction
          </button>
        </div>
      </header>

      {fetchError && (
        <div className="mb-4 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-400">
          {fetchError}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-navy-700 text-gray-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Timeline predictions={filtered} />
      <NewPredictionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

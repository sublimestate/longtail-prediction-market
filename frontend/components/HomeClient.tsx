'use client';

import { useState, useEffect } from 'react';
import type { Prediction, EscrowState } from '@/lib/types';
import { Timeline } from './Timeline';
import { NewPredictionModal } from './NewPredictionModal';
import { ConnectButton } from './ConnectButton';

const FILTERS: (EscrowState | 'All')[] = ['All', 'Created', 'Funded', 'JuryResolving', 'Resolving', 'Settled'];

export function HomeClient({ initial }: { initial: Prediction[] }) {
  const [predictions, setPredictions] = useState(initial);
  const [filter, setFilter] = useState<EscrowState | 'All'>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const ACTIVE_STATES = new Set(['Funded', 'Resolving', 'JuryResolving']);

  const stats = {
    total: predictions.length,
    staked: predictions.reduce((sum, p) => {
      const amt = parseFloat(p.stakeAmount) || 0;
      return sum + (p.state === 'Created' ? amt : amt * 2);
    }, 0),
    active: predictions.filter((p) => ACTIVE_STATES.has(p.state)).length,
  };

  const counts = predictions.reduce<Record<string, number>>((acc, p) => {
    acc[p.state] = (acc[p.state] || 0) + 1;
    return acc;
  }, {});

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

  const filtered = (filter === 'All' ? predictions : predictions.filter((p) => p.state === filter)).slice().reverse();

  return (
    <>
      <header className="mb-8">
        <div className="flex justify-between items-start mb-1">
          <div>
            <h1 className="text-3xl font-bold inline-block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Longtail
            </h1>
            <p className="text-gray-500 text-sm mt-1">Agent-powered P2P predictions on Base</p>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton />
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white font-medium"
            >
              + New Prediction
            </button>
          </div>
        </div>
      </header>

      {fetchError && (
        <div className="mb-4 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-400">
          {fetchError}
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="flex-1 bg-navy-800 border border-navy-700 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 uppercase">Markets</p>
          <p className="text-lg font-bold text-white">{stats.total}</p>
        </div>
        <div className="flex-1 bg-navy-800 border border-navy-700 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 uppercase">Total Staked</p>
          <p className="text-lg font-bold text-white">{stats.staked % 1 === 0 ? stats.staked : stats.staked.toFixed(2)} USDC</p>
        </div>
        <div className="flex-1 bg-navy-800 border border-navy-700 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 uppercase">Active</p>
          <p className="text-lg font-bold text-white">{stats.active}</p>
        </div>
      </div>

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
            {f} ({f === 'All' ? predictions.length : counts[f] || 0})
          </button>
        ))}
      </div>

      <Timeline predictions={filtered} />
      <NewPredictionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

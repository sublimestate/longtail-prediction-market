'use client';

import { useState } from 'react';

export function NewPredictionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prediction, setPrediction] = useState('');
  const [stakeAmount, setStakeAmount] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prediction, stakeAmount, deadline: deadline || undefined }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setResult({ success: true, message: data.message || 'Submitted!' });
        setPrediction('');
        setStakeAmount('1');
        setDeadline('');
      } else {
        setResult({ success: false, message: data.error || 'Failed to submit' });
      }
    } catch {
      setResult({ success: false, message: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white text-lg font-semibold mb-4">New Prediction</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Prediction</label>
            <textarea
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              placeholder="Will ETH hit $5,000 by June 2026?"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
              rows={3}
              required
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Stake (USDC)</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          {result && (
            <p className={`text-sm ${result.success ? 'text-status-settled' : 'text-red-400'}`}>
              {result.message}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !prediction}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white font-medium"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

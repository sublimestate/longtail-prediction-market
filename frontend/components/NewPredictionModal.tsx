'use client';

import { useState } from 'react';

export function NewPredictionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prediction, setPrediction] = useState('');
  const [stakeAmount, setStakeAmount] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [resolution, setResolution] = useState<'jury' | 'uma'>('jury');
  const [challengeWindow, setChallengeWindow] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);


  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    const trimmed = prediction.trim();
    if (trimmed.length < 20) {
      setValidationError('Prediction must be at least 20 characters');
      return;
    }
    if (!/\?/.test(trimmed)) {
      setValidationError('Prediction should be phrased as a question (include a "?")');
      return;
    }
    const stake = parseFloat(stakeAmount);
    if (isNaN(stake) || stake < 0.01 || stake > 1000) {
      setValidationError('Stake must be between 0.01 and 1000 USDC');
      return;
    }
    if (!deadline) {
      setValidationError('Deadline is required');
      return;
    }
    if (new Date(deadline).getTime() <= Date.now() + 5 * 60 * 1000) {
      setValidationError('Deadline must be at least 5 minutes from now');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prediction,
          stakeAmount,
          deadline: deadline || undefined,
          challengeWindow: resolution === 'jury' ? parseInt(challengeWindow) * 60 : 300,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setResult({ success: true, message: data.message || 'Submitted!' });
        setPrediction('');
        setStakeAmount('1');
        setDeadline('');
        setResolution('jury');
        setChallengeWindow('10');
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
            <p className="text-xs text-gray-600 mb-1">A yes/no question about a specific, verifiable future event</p>
            <textarea
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              placeholder="Will ETH hit $5,000 by June 2026?"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
              rows={3}
              maxLength={500}
              required
            />
            <p className="text-xs text-gray-600 mt-1">{prediction.trim().length}/500 (min 20)</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Stake (USDC)</label>
              <p className="text-xs text-gray-600 mb-1">Each side puts up this amount</p>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min="0.01"
                max="1000"
                step="0.01"
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Deadline</label>
              <p className="text-xs text-gray-600 mb-1">Resolution starts after this time</p>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => { setDeadline(e.target.value); setValidationError(null); }}
                required
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Resolution Method</label>
            <p className="text-xs text-gray-600 mb-2">How the outcome gets decided after the deadline</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResolution('jury')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  resolution === 'jury'
                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                    : 'bg-navy-900 border-navy-700 text-gray-500 hover:border-gray-600'
                }`}
              >
                LLM Jury
              </button>
              <button
                type="button"
                onClick={() => setResolution('uma')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  resolution === 'uma'
                    ? 'bg-status-resolving/20 border-status-resolving/50 text-status-resolving'
                    : 'bg-navy-900 border-navy-700 text-gray-500 hover:border-gray-600'
                }`}
              >
                UMA Oracle
              </button>
            </div>
            {resolution === 'jury' && (
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">Challenge window (minutes)</label>
                <input
                  type="number"
                  value={challengeWindow}
                  onChange={(e) => setChallengeWindow(e.target.value)}
                  min="5"
                  max="1440"
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-gray-600 mt-1">Parties can challenge to escalate to UMA during this window</p>
              </div>
            )}
            {resolution === 'uma' && (
              <p className="text-xs text-gray-600 mt-2">2hr UMA liveness period — disputes escalate to decentralized voting</p>
            )}
          </div>
          {validationError && (
            <p className="text-sm text-red-400">{validationError}</p>
          )}
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
              disabled={submitting || prediction.trim().length < 20 || !deadline}
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

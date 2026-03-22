'use client';

import { useState, useEffect } from 'react';

export function ResolveButton({ escrowAddress }: { escrowAddress: string }) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  async function handleResolve() {
    setStatus('pending');
    setMessage('');

    try {
      const resp = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escrowAddress }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setStatus('error');
        setMessage(data.error || 'Failed to dispatch resolution');
        return;
      }

      setStatus('success');
      setMessage('Resolution dispatched to jury agent. This may take a few minutes.');
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || 'Network error');
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleResolve}
        disabled={status === 'pending' || status === 'success'}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          status === 'success'
            ? 'bg-green-600/20 text-green-400 cursor-default'
            : status === 'pending'
              ? 'bg-purple-600/50 text-purple-300 cursor-wait'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
        }`}
      >
        {status === 'pending'
          ? 'Dispatching...'
          : status === 'success'
            ? 'Dispatched'
            : 'Request Jury Resolution'}
      </button>
      {message && (
        <p className={`text-xs mt-2 ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

export function CountdownTimer({ targetTimestamp }: { targetTimestamp: number }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = targetTimestamp - Math.floor(Date.now() / 1000);
      if (diff <= 0) {
        setRemaining('Expired');
        return;
      }
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      if (days > 0) setRemaining(`${days}d ${hours}h`);
      else if (hours > 0) setRemaining(`${hours}h ${mins}m`);
      else setRemaining(`${mins}m`);
    }
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return <span className="text-gray-400 text-sm">{remaining}</span>;
}

'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !isConnected) {
    return (
      <button
        onClick={() => connect({ connector: injected() })}
        className="px-4 py-2 bg-navy-800 border border-navy-700 hover:border-purple-500 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
      >
        Connect Wallet
      </button>
    );
  }

  const wrongChain = chainId !== baseSepolia.id;

  if (wrongChain) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => switchChain({ chainId: baseSepolia.id })}
          className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/40 hover:border-yellow-500 rounded-lg text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
        >
          Switch to Base Sepolia
        </button>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 bg-navy-800 border border-navy-700 hover:border-red-500/50 rounded-lg text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-gray-400">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </span>
      <button
        onClick={() => disconnect()}
        className="px-3 py-1.5 bg-navy-800 border border-navy-700 hover:border-red-500/50 rounded-lg text-xs text-gray-400 hover:text-red-400 transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}

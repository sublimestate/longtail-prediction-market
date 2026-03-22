'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi';

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: injected() })}
        className="px-4 py-2 bg-navy-800 border border-navy-700 hover:border-purple-500 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
      >
        Connect Wallet
      </button>
    );
  }

  const wrongChain = chainId !== 84532;

  return (
    <div className="flex items-center gap-2">
      {wrongChain && (
        <span className="text-xs text-yellow-400">Wrong network</span>
      )}
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

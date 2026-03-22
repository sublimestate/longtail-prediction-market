import type { RunResult } from '@openserv-labs/sdk';

const RECONNECT_INTERVAL_MS = 50_000; // 50 seconds — before the proxy's 60-120s hard timeout

/**
 * Proactively reconnects the tunnel before the proxy drops it.
 * The OpenServ proxy has a hard 60-120s timeout that drops WebSocket connections.
 * gracefulReconnect() tells the proxy to buffer requests during the brief reconnect,
 * so no task dispatches are lost.
 */
export function startKeepAlive(result: RunResult, agentName: string): NodeJS.Timeout | null {
  const tunnel = result.tunnel;
  if (!tunnel) {
    console.log(`[${agentName}] Tunnel disabled — skipping keep-alive`);
    return null;
  }

  const interval = setInterval(async () => {
    if (!tunnel.isConnected()) return;

    try {
      await tunnel.gracefulReconnect();
    } catch (e) {
      console.error(`[${agentName}] Graceful reconnect failed:`, e);
    }
  }, RECONNECT_INTERVAL_MS);

  console.log(`[${agentName}] Keep-alive started (graceful reconnect every ${RECONNECT_INTERVAL_MS / 1000}s)`);
  return interval;
}

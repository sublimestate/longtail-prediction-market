import Link from 'next/link';
import { getEscrowState } from '@/lib/contracts';
import { getAgentMetadata } from '@/lib/openserv';
import { StatusBadge } from '@/components/StatusBadge';
import { PipelineStepper } from '@/components/PipelineStepper';
import { JuryCard } from '@/components/JuryCard';
import { CountdownTimer } from '@/components/CountdownTimer';
import type { Address } from 'viem';

export const dynamic = 'force-dynamic';

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const ZERO_ASSERTION = '0x0000000000000000000000000000000000000000000000000000000000000000';

export default async function PredictionPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  let prediction;
  try {
    prediction = await getEscrowState(address as Address);
    const meta = await getAgentMetadata(address);
    if (meta) Object.assign(prediction, meta);
  } catch (e: any) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm mb-4 block">← Back</Link>
        <p className="text-red-400">Failed to load prediction: {e.message}</p>
      </main>
    );
  }

  const basescanUrl = `https://sepolia.basescan.org/address/${address}`;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm mb-6 block">← Back</Link>

      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-xl font-bold text-white flex-1 mr-4">
            {prediction.description || 'Untitled prediction'}
          </h1>
          <StatusBadge state={prediction.state} />
        </div>
        <PipelineStepper current={prediction.state} />
      </div>

      {/* Escrow Info */}
      <section className="bg-navy-800 border border-navy-700 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Escrow Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Contract</span>
            <a href={basescanUrl} target="_blank" rel="noopener noreferrer" className="block font-mono text-purple-400 hover:text-purple-300">
              {truncateAddress(address)}
            </a>
          </div>
          <div>
            <span className="text-gray-500">Stake</span>
            <p className="text-white">{prediction.stakeAmount} USDC</p>
          </div>
          <div>
            <span className="text-gray-500">Party YES</span>
            <p className="font-mono text-white">{truncateAddress(prediction.partyYes)}</p>
          </div>
          <div>
            <span className="text-gray-500">Party NO</span>
            <p className="font-mono text-white">{truncateAddress(prediction.partyNo)}</p>
          </div>
          <div>
            <span className="text-gray-500">Deadline</span>
            <p className="text-white">{new Date(prediction.deadline * 1000).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Time Left</span>
            <CountdownTimer targetTimestamp={prediction.deadline} />
          </div>
        </div>
      </section>

      {/* UMA Section — visible when Resolving */}
      {prediction.state === 'Resolving' && prediction.assertionId !== ZERO_ASSERTION && (
        <section className="bg-navy-800 border border-status-resolving/30 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-status-resolving uppercase mb-3">UMA Dispute Window</h2>
          <div className="text-sm">
            <p className="text-gray-400 mb-1">Assertion ID</p>
            <a
              href={`https://testnet.oracle.uma.xyz/assertion/${prediction.assertionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-purple-400 hover:text-purple-300 text-xs break-all block"
            >
              {prediction.assertionId}
            </a>
            <p className="text-status-resolving text-xs mt-2">2hr liveness period active. Call settle-assertion after window closes.</p>
          </div>
        </section>
      )}

      {/* Settlement Section — visible when Settled */}
      {prediction.state === 'Settled' && (
        <section className="bg-navy-800 border border-status-settled/30 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-status-settled uppercase mb-3">Settlement</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Outcome</span>
              <p className={`font-bold ${prediction.resolvedYes ? 'text-status-settled' : 'text-red-400'}`}>
                {prediction.resolvedYes ? 'YES' : 'NO'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Winner</span>
              <p className="font-mono text-white">
                {truncateAddress(prediction.resolvedYes ? prediction.partyYes : prediction.partyNo)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Jury Section — visible when resolving or settled, if votes available */}
      {prediction.juryVotes && prediction.juryVotes.length > 0 && (
        <section className="mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Jury Votes</h2>
          <div className="space-y-3">
            {prediction.juryVotes.map((vote) => (
              <JuryCard key={vote.agentId} vote={vote} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

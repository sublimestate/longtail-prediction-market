import Link from 'next/link';
import { getEscrowState } from '@/lib/contracts';
import { getAgentMetadata } from '@/lib/openserv';
import { StatusBadge } from '@/components/StatusBadge';
import { PipelineStepper } from '@/components/PipelineStepper';
import { JuryCard } from '@/components/JuryCard';
import { CountdownTimer } from '@/components/CountdownTimer';
import { SettleButton } from '@/components/SettleButton';
import { SettleJuryButton } from '@/components/SettleJuryButton';
import { ChallengeJuryButton } from '@/components/ChallengeJuryButton';
import { FundButton } from '@/components/FundButton';
import { isAddress, type Address } from 'viem';

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

  if (!isAddress(address)) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm mb-4 block">← Longtail</Link>
        <p className="text-red-400">Invalid address</p>
      </main>
    );
  }

  let prediction;
  try {
    const base = await getEscrowState(address as Address);
    const meta = await getAgentMetadata(address);
    prediction = meta ? { ...base, ...meta } : base;
  } catch (e: any) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm mb-4 block">← Longtail</Link>
        <p className="text-red-400">Failed to load prediction: {e.message}</p>
      </main>
    );
  }

  const basescanUrl = `https://sepolia.basescan.org/address/${address}`;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm mb-6 block">← Longtail</Link>

      <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-[2px] mb-6">
        <div className="bg-navy-800 rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <h1 className="text-2xl font-bold text-white flex-1 mr-4">
              {prediction.description || 'Untitled prediction'}
            </h1>
            <div className="flex items-center gap-2">
              {prediction.state === 'JuryResolving' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">LLM Jury</span>
              )}
              {prediction.state === 'Resolving' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">UMA Oracle</span>
              )}
              <StatusBadge state={prediction.state} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <span className="text-xs text-gray-500">Pool</span>
              <p className="text-sm text-white font-medium">
                {prediction.state === 'Created'
                  ? `${prediction.stakeAmount} USDC per side`
                  : `${parseFloat(prediction.stakeAmount) * 2} USDC`}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Deadline</span>
              <p className="text-sm text-white">{new Date(prediction.deadline * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Resolution Window</span>
              <div className="text-sm text-white"><CountdownTimer targetTimestamp={prediction.deadline} /></div>
            </div>
          </div>
          <PipelineStepper current={prediction.state} />
        </div>
      </div>

      {/* Outcome Callout */}
      {prediction.state === 'Settled' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium">
            <span className={prediction.resolvedYes ? 'text-green-400' : 'text-red-400'}>
              {prediction.resolvedYes ? 'YES' : 'NO'}
            </span>
            <span className="text-gray-300">
              {' '}wins — {parseFloat(prediction.stakeAmount) * 2} USDC paid to{' '}
              {truncateAddress(prediction.resolvedYes ? prediction.partyYes : prediction.partyNo)}
            </span>
          </p>
        </div>
      )}
      {prediction.state === 'JuryResolving' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium">
            <span className="text-gray-300">Jury proposed: </span>
            <span className={prediction.juryOutcomeYes ? 'text-green-400' : 'text-red-400'}>
              {prediction.juryOutcomeYes ? 'YES' : 'NO'}
            </span>
            <span className="text-gray-300"> — challenge window closes in </span>
            <CountdownTimer targetTimestamp={prediction.juryDeadline} />
          </p>
        </div>
      )}

      {/* Escrow Info */}
      <section className="bg-navy-800 border border-navy-700 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Escrow Details</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Contract</span>
            <a href={basescanUrl} target="_blank" rel="noopener noreferrer" className="block font-mono text-purple-400 hover:text-purple-300">
              {truncateAddress(address)}
            </a>
          </div>
          <div>
            <span className="text-gray-500">Party YES</span>
            <a href={`https://sepolia.basescan.org/address/${prediction.partyYes}`} target="_blank" rel="noopener noreferrer" className="block font-mono text-purple-400 hover:text-purple-300">{truncateAddress(prediction.partyYes)}</a>
          </div>
          <div>
            <span className="text-gray-500">Party NO</span>
            {prediction.partyNo === '0x0000000000000000000000000000000000000000' ? (
              <p className="text-purple-400 font-medium">Open — anyone can match</p>
            ) : (
              <a href={`https://sepolia.basescan.org/address/${prediction.partyNo}`} target="_blank" rel="noopener noreferrer" className="block font-mono text-purple-400 hover:text-purple-300">{truncateAddress(prediction.partyNo)}</a>
            )}
          </div>
        </div>
      </section>

      {/* Funding Section — visible when Created */}
      {prediction.state === 'Created' && (
        <section className="bg-navy-800 border border-purple-500/30 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-purple-400 uppercase mb-3">Fund This Prediction</h2>
          <div className="text-sm space-y-1">
            <p className="text-gray-400">
              Party YES ({truncateAddress(prediction.partyYes)}): {prediction.partyYesDeposited ? <span className="text-status-settled">Deposited</span> : <span className="text-yellow-400">Awaiting deposit</span>}
            </p>
            <p className="text-gray-400">
              Party NO ({prediction.partyNo === '0x0000000000000000000000000000000000000000' ? 'Open' : truncateAddress(prediction.partyNo)}): {prediction.partyNoDeposited ? <span className="text-status-settled">Deposited</span> : <span className="text-yellow-400">Awaiting deposit</span>}
            </p>
          </div>
          <FundButton
            escrowAddress={address}
            stakeAmount={prediction.stakeAmount}
            partyYes={prediction.partyYes}
            partyNo={prediction.partyNo}
            partyYesDeposited={prediction.partyYesDeposited}
            partyNoDeposited={prediction.partyNoDeposited}
          />
        </section>
      )}

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
            <SettleButton assertionId={prediction.assertionId} escrowAddress={address} />
          </div>
        </section>
      )}

      {/* Jury Resolution Section — visible when JuryResolving */}
      {prediction.state === 'JuryResolving' && (
        <section className="bg-navy-800 border border-yellow-500/30 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-yellow-400 uppercase mb-3">Jury Resolution</h2>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Proposed Outcome</span>
              <span className={`font-bold ${prediction.juryOutcomeYes ? 'text-status-settled' : 'text-red-400'}`}>
                {prediction.juryOutcomeYes ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Challenge Window</span>
              <CountdownTimer targetTimestamp={prediction.juryDeadline} />
            </div>
            <p className="text-yellow-400/80 text-xs mt-2">
              Either party can challenge to escalate to UMA. If unchallenged, anyone can settle after the window expires.
            </p>
            <div className="flex gap-2 mt-2">
              <ChallengeJuryButton escrowAddress={address} />
              <SettleJuryButton escrowAddress={address} />
            </div>
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

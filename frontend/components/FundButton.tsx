'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbi, parseUnits, type Address } from 'viem';

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;

const usdcAbi = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
]);

const escrowAbi = parseAbi([
  'function deposit() external',
]);

type Step = 'idle' | 'approving' | 'depositing' | 'success' | 'error';

export function FundButton({
  escrowAddress,
  stakeAmount,
  partyYes,
  partyNo,
  partyYesDeposited,
  partyNoDeposited,
}: {
  escrowAddress: string;
  stakeAmount: string;
  partyYes: string;
  partyNo: string;
  partyYesDeposited: boolean;
  partyNoDeposited: boolean;
}) {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [txHash, setTxHash] = useState<string>();

  const { writeContractAsync } = useWriteContract();

  if (!isConnected) {
    return <p className="text-xs text-gray-500 mt-2">Connect wallet to fund</p>;
  }

  const addrLower = address?.toLowerCase();
  const isYes = addrLower === partyYes.toLowerCase();
  const isOpen = partyNo === '0x0000000000000000000000000000000000000000';
  const isNo = !isOpen && addrLower === partyNo.toLowerCase();
  const canMatch = isOpen && !isYes; // anyone except partyYes can claim the NO side

  if (!isYes && !isNo && !canMatch) {
    return <p className="text-xs text-gray-500 mt-2">Your wallet is not a party in this prediction</p>;
  }

  const alreadyDeposited = (isYes && partyYesDeposited) || (isNo && partyNoDeposited);
  if (alreadyDeposited) {
    return <p className="text-xs text-status-settled mt-2">You have already deposited</p>;
  }

  const side = canMatch ? 'NO' : isYes ? 'YES' : 'NO';
  const label = canMatch ? `Match & Fund ${stakeAmount} USDC (take NO side)` : `Fund ${stakeAmount} USDC (Party ${side})`;

  async function handleFund() {
    setStep('approving');
    setErrorMsg('');
    try {
      const stakeWei = parseUnits(stakeAmount, 6);

      // Step 1: Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: usdcAbi,
        functionName: 'approve',
        args: [escrowAddress as Address, stakeWei],
      });

      // Step 2: Deposit
      setStep('depositing');
      const hash = await writeContractAsync({
        address: escrowAddress as Address,
        abi: escrowAbi,
        functionName: 'deposit',
      });

      setTxHash(hash);
      setStep('success');
    } catch (e: any) {
      setErrorMsg(e?.message?.split('\n')[0] || 'Transaction failed');
      setStep('error');
    }
  }

  return (
    <div className="mt-3">
      {step === 'idle' && (
        <button
          onClick={handleFund}
          className="px-4 py-2 bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 rounded-lg text-sm text-purple-400 font-medium transition-colors"
        >
          {label}
        </button>
      )}
      {step === 'approving' && (
        <p className="text-xs text-purple-400">Approving USDC... confirm in wallet</p>
      )}
      {step === 'depositing' && (
        <p className="text-xs text-purple-400">Depositing... confirm in wallet</p>
      )}
      {step === 'success' && txHash && (
        <p className="text-xs text-status-settled">
          Funded!{' '}
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            View tx
          </a>
        </p>
      )}
      {step === 'error' && (
        <div>
          <p className="text-xs text-red-400">{errorMsg}</p>
          <button
            onClick={() => setStep('idle')}
            className="text-xs text-gray-400 hover:text-white mt-1"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

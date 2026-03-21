import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address } from 'viem';

// Mock config before importing blockchain module
vi.mock('./config.js', () => ({
  config: {
    blockchain: {
      deployerPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      counterpartyPrivateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
      baseSepoliaRpcUrl: 'https://sepolia.base.org',
      factoryAddress: '0x0000000000000000000000000000000000000001',
    },
    contracts: {
      umaOOv3BaseSepolia: '0x0F7fC5E6482f096380db6158f978167b57388deE',
      usdcBaseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
  },
}));

const ESCROW = '0x1234567890abcdef1234567890abcdef12345678' as Address;
const PARTY_YES = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address;
const PARTY_NO = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address;
const ASSERTION_ID = '0x00000000000000000000000000000000000000000000000000000000deadbeef' as `0x${string}`;
const ZERO_ASSERTION = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
const TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

function makeEscrowState(overrides: Record<string, any> = {}) {
  return {
    state: 'Resolving',
    partyYes: PARTY_YES,
    partyNo: PARTY_NO,
    stakeAmount: 1000000n,
    deadline: 1700000000n,
    description: 'Test prediction',
    assertionId: ASSERTION_ID,
    resolvedYes: false,
    ...overrides,
  };
}

// We need to mock publicClient and deployerWallet at module level
const mockReadContract = vi.fn();
const mockWriteContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: () => ({
      readContract: mockReadContract,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    }),
    createWalletClient: () => ({
      account: { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
      writeContract: mockWriteContract,
    }),
  };
});

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: (key: string) => ({
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  }),
}));

// Import after mocks
const { settleAssertion, getEscrowState } = await import('./blockchain.js');

describe('settleAssertion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('settles a Resolving escrow and returns result', async () => {
    // First call: state check (Resolving)
    // Second call: post-settle state check (Settled)
    let callCount = 0;
    mockReadContract.mockImplementation(({ functionName }: any) => {
      callCount++;
      // First 8 calls = first getEscrowState (Resolving)
      // Next 8 calls = second getEscrowState (Settled, resolvedYes=true)
      if (callCount <= 8) {
        switch (functionName) {
          case 'state': return 2; // Resolving
          case 'partyYes': return PARTY_YES;
          case 'partyNo': return PARTY_NO;
          case 'stakeAmount': return 1000000n;
          case 'deadline': return 1700000000n;
          case 'description': return 'Test prediction';
          case 'assertionId': return ASSERTION_ID;
          case 'resolvedYes': return false;
        }
      } else {
        switch (functionName) {
          case 'state': return 3; // Settled
          case 'partyYes': return PARTY_YES;
          case 'partyNo': return PARTY_NO;
          case 'stakeAmount': return 1000000n;
          case 'deadline': return 1700000000n;
          case 'description': return 'Test prediction';
          case 'assertionId': return ASSERTION_ID;
          case 'resolvedYes': return true;
        }
      }
    });
    mockWriteContract.mockResolvedValue(TX_HASH);
    mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' });

    const result = await settleAssertion(ESCROW);

    expect(result.txHash).toBe(TX_HASH);
    expect(result.resolvedYes).toBe(true);
    expect(result.winner).toBe(PARTY_YES);
    expect(mockWriteContract).toHaveBeenCalledOnce();
    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'settleAssertion',
        args: [ASSERTION_ID],
      }),
    );
  });

  it('returns partyNo as winner when resolvedYes is false', async () => {
    let callCount = 0;
    mockReadContract.mockImplementation(({ functionName }: any) => {
      callCount++;
      if (callCount <= 8) {
        switch (functionName) {
          case 'state': return 2;
          case 'partyYes': return PARTY_YES;
          case 'partyNo': return PARTY_NO;
          case 'stakeAmount': return 1000000n;
          case 'deadline': return 1700000000n;
          case 'description': return 'Test';
          case 'assertionId': return ASSERTION_ID;
          case 'resolvedYes': return false;
        }
      } else {
        switch (functionName) {
          case 'state': return 3;
          case 'partyYes': return PARTY_YES;
          case 'partyNo': return PARTY_NO;
          case 'stakeAmount': return 1000000n;
          case 'deadline': return 1700000000n;
          case 'description': return 'Test';
          case 'assertionId': return ASSERTION_ID;
          case 'resolvedYes': return false;
        }
      }
    });
    mockWriteContract.mockResolvedValue(TX_HASH);
    mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' });

    const result = await settleAssertion(ESCROW);

    expect(result.resolvedYes).toBe(false);
    expect(result.winner).toBe(PARTY_NO);
  });

  it('throws if escrow is already Settled', async () => {
    mockReadContract.mockImplementation(({ functionName }: any) => {
      switch (functionName) {
        case 'state': return 3; // Settled
        case 'partyYes': return PARTY_YES;
        case 'partyNo': return PARTY_NO;
        case 'stakeAmount': return 1000000n;
        case 'deadline': return 1700000000n;
        case 'description': return 'Test';
        case 'assertionId': return ASSERTION_ID;
        case 'resolvedYes': return true;
      }
    });

    await expect(settleAssertion(ESCROW)).rejects.toThrow('already settled');
    expect(mockWriteContract).not.toHaveBeenCalled();
  });

  it('throws if escrow is not in Resolving state', async () => {
    mockReadContract.mockImplementation(({ functionName }: any) => {
      switch (functionName) {
        case 'state': return 1; // Funded
        case 'partyYes': return PARTY_YES;
        case 'partyNo': return PARTY_NO;
        case 'stakeAmount': return 1000000n;
        case 'deadline': return 1700000000n;
        case 'description': return 'Test';
        case 'assertionId': return ZERO_ASSERTION;
        case 'resolvedYes': return false;
      }
    });

    await expect(settleAssertion(ESCROW)).rejects.toThrow('must be "Resolving"');
    expect(mockWriteContract).not.toHaveBeenCalled();
  });

  it('throws if assertionId is zero', async () => {
    mockReadContract.mockImplementation(({ functionName }: any) => {
      switch (functionName) {
        case 'state': return 2; // Resolving
        case 'partyYes': return PARTY_YES;
        case 'partyNo': return PARTY_NO;
        case 'stakeAmount': return 1000000n;
        case 'deadline': return 1700000000n;
        case 'description': return 'Test';
        case 'assertionId': return ZERO_ASSERTION;
        case 'resolvedYes': return false;
      }
    });

    await expect(settleAssertion(ESCROW)).rejects.toThrow('No assertionId');
    expect(mockWriteContract).not.toHaveBeenCalled();
  });
});

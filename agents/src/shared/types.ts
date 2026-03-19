export interface PredictionSpec {
  id: string;
  description: string;
  deadline: number; // unix timestamp
  stakeAmount: string; // USDC amount (human readable, e.g. "10")
  resolutionCriteria: string;
  status: 'open' | 'matched' | 'funded' | 'resolving' | 'settled' | 'expired';
  partyYes?: { address: string };
  partyNo?: { address: string };
  escrowAddress?: string;
  assertionId?: string;
  createdAt: number;
}

export interface JuryVote {
  agentId: number;
  vote: boolean; // true = yes outcome, false = no outcome
  reasoning: string;
}

export interface ResolutionResult {
  outcome: boolean;
  votes: JuryVote[];
  claim: string;
}

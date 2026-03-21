export type EscrowState = 'Created' | 'Funded' | 'Resolving' | 'Settled' | 'Expired';

export interface JuryVote {
  agentId: number;
  role: 'skeptic' | 'optimist' | 'arbiter';
  vote: boolean;
  reasoning: string;
}

export interface Prediction {
  escrowAddress: string;
  description: string;
  state: EscrowState;
  stakeAmount: string;
  deadline: number;
  partyYes: string;
  partyNo: string;
  assertionId: string;
  resolvedYes: boolean;
  juryVotes?: JuryVote[];
  resolutionCriteria?: string;
}

export type EscrowState = 'Created' | 'Funded' | 'Resolving' | 'Settled' | 'Expired' | 'JuryResolving';

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
  partyYesDeposited: boolean;
  partyNoDeposited: boolean;
  assertionId: string;
  resolvedYes: boolean;
  challengeWindow: number;
  juryOutcomeYes: boolean;
  juryDeadline: number;
  juryVotes?: JuryVote[];
  resolutionCriteria?: string;
}

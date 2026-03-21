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

/**
 * Parse a PredictionSpec from any agent's output format.
 * Handles: raw PredictionSpec, Market Maker LLM format (nested 'structured'),
 * previous agent output with embedded JSON, and ISO/unix deadline formats.
 */
export function parsePredictionSpec(input: string): PredictionSpec {
  // Try to extract JSON from markdown code blocks or raw text
  let raw: any;
  const jsonMatch = input.match(/```json\s*([\s\S]*?)```/) || input.match(/```\s*([\s\S]*?)```/);
  if (jsonMatch) {
    raw = JSON.parse(jsonMatch[1].trim());
  } else {
    raw = JSON.parse(input);
  }

  // Handle Market Maker nested format
  const data = raw.structured || raw;

  // Normalize deadline: accept unix timestamp or ISO string
  let deadline: number;
  const rawDeadline = data.deadline ?? data.resolutionTime ?? raw.deadline;
  if (typeof rawDeadline === 'number') {
    deadline = rawDeadline;
  } else if (typeof rawDeadline === 'string') {
    deadline = Math.floor(new Date(rawDeadline).getTime() / 1000);
  } else {
    deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // default 1 week
  }

  // Normalize party addresses: accept {address: "0x..."} or "0x..."
  const normalizeParty = (p: any): { address: string } | undefined => {
    if (!p) return undefined;
    if (typeof p === 'string') return { address: p };
    if (p.address) return { address: p.address };
    return undefined;
  };

  return {
    id: String(raw.id ?? data.id ?? 'unknown'),
    description: data.prediction || data.description || raw.naturalLanguagePrediction || raw.description || '',
    deadline,
    stakeAmount: String(data.stakeAmount ?? data.stake ?? raw.stakeAmount ?? '10'),
    resolutionCriteria: data.resolutionCriteria || data.resolutionCondition || data.adjudicationRule || '',
    status: data.status || raw.status || 'open',
    partyYes: normalizeParty(data.partyYes ?? raw.partyYes),
    partyNo: normalizeParty(data.partyNo ?? raw.partyNo),
    escrowAddress: data.escrowAddress || raw.escrowAddress,
    assertionId: data.assertionId || raw.assertionId,
    createdAt: data.createdAt || raw.createdAt || Math.floor(Date.now() / 1000),
  };
}

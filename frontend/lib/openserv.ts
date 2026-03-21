import type { JuryVote } from './types';

const ROLE_MAP: Record<number, JuryVote['role']> = {
  1: 'skeptic',
  2: 'optimist',
  3: 'arbiter',
};

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 30_000; // 30s

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

export interface AgentMetadata {
  juryVotes?: JuryVote[];
  resolutionCriteria?: string;
}

export async function getAgentMetadata(escrowAddress: string): Promise<AgentMetadata | null> {
  const cacheKey = `metadata:${escrowAddress}`;
  const cached = getCached<AgentMetadata>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.OPENSERV_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch('https://api.openserv.ai/workspaces/tasks/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: escrowAddress }),
    });

    if (!resp.ok) return null;

    const tasks = await resp.json();
    const metadata: AgentMetadata = {};

    for (const task of Array.isArray(tasks) ? tasks : []) {
      const output = task.output || task.result || '';
      if (typeof output !== 'string') continue;

      const jsonMatch = output.match(/```json\s*([\s\S]*?)```/) || output.match(/\{[\s\S]*"votes"[\s\S]*\}/);
      if (!jsonMatch) continue;

      try {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        if (parsed.votes && Array.isArray(parsed.votes)) {
          metadata.juryVotes = parsed.votes.map((v: any) => ({
            agentId: v.agent || v.agentId,
            role: ROLE_MAP[v.agent || v.agentId] || 'arbiter',
            vote: v.vote === 'YES' || v.vote === true,
            reasoning: v.reasoning || '',
          }));
        }
        if (parsed.claim) {
          metadata.resolutionCriteria = parsed.claim;
        }
      } catch {
        continue;
      }
    }

    setCache(cacheKey, metadata);
    return metadata;
  } catch {
    return null;
  }
}

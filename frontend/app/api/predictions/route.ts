import { NextResponse } from 'next/server';
import { getAllPredictions } from '@/lib/contracts';
import { getAgentMetadata } from '@/lib/openserv';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const predictions = await getAllPredictions();

    // Enrich with agent metadata (non-fatal — null fields if unavailable)
    const enriched = await Promise.all(
      predictions.map(async (p) => {
        const meta = await getAgentMetadata(p.escrowAddress);
        return { ...p, ...meta };
      })
    );

    return NextResponse.json({ predictions: enriched });
  } catch (e: any) {
    console.error('Failed to fetch predictions:', e);
    return NextResponse.json({ error: e.message || 'Failed to fetch predictions' }, { status: 500 });
  }
}

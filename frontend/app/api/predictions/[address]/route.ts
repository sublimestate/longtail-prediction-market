import { NextResponse } from 'next/server';
import { getEscrowState } from '@/lib/contracts';
import { getAgentMetadata } from '@/lib/openserv';
import type { Address } from 'viem';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }
    const prediction = await getEscrowState(address as Address);
    const meta = await getAgentMetadata(address);
    return NextResponse.json({ ...prediction, ...meta });
  } catch (e: any) {
    console.error('Failed to fetch prediction:', e);
    return NextResponse.json({ error: e.message || 'Failed to fetch prediction' }, { status: 500 });
  }
}

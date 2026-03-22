import { NextResponse } from 'next/server';
import { getEscrowState } from '@/lib/contracts';
import { isAddress, type Address } from 'viem';

export async function POST(request: Request) {
  try {
    const { escrowAddress } = await request.json();

    if (!escrowAddress || !isAddress(escrowAddress)) {
      return NextResponse.json({ error: 'Valid escrow address required' }, { status: 400 });
    }

    const token = process.env.JURY_WEBHOOK_TOKEN;
    if (!token) return NextResponse.json({ error: 'JURY_WEBHOOK_TOKEN not configured' }, { status: 500 });

    const state = await getEscrowState(escrowAddress as Address);

    if (state.state !== 'Funded') {
      return NextResponse.json(
        { error: `Escrow is "${state.state}" — must be "Funded" to resolve` },
        { status: 422 },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < state.deadline) {
      return NextResponse.json(
        { error: `Deadline not reached. ${Math.ceil((state.deadline - now) / 60)} min remaining.` },
        { status: 422 },
      );
    }

    // Fire-and-forget: trigger jury workflow on OpenServ
    const resp = await fetch(`https://api.openserv.ai/webhooks/trigger/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        escrowAddress,
        description: state.description,
        deadline: new Date(state.deadline * 1000).toISOString(),
      }),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: `Webhook failed: ${await resp.text()}` }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: 'Jury resolution dispatched. The 3-member jury is deliberating — check back in ~1-2 minutes.',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to dispatch' }, { status: 500 });
  }
}

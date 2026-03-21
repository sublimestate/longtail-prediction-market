import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prediction, stakeAmount, deadline } = body;

    if (!prediction || typeof prediction !== 'string') {
      return NextResponse.json({ error: 'prediction is required' }, { status: 400 });
    }

    const webhookToken = process.env.WEBHOOK_TOKEN;
    if (!webhookToken) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const resp = await fetch(`https://api.openserv.ai/webhooks/trigger/${webhookToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prediction,
        stakeAmount: stakeAmount || '1',
        deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `Webhook failed: ${text}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Prediction submitted to pipeline' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to submit prediction' }, { status: 500 });
  }
}

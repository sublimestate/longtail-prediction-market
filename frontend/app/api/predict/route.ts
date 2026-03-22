import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI();

async function validatePrediction(prediction: string): Promise<{ valid: boolean; reason: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `You evaluate whether a prediction is suitable for a prediction market. A valid prediction must be:
1. A specific, falsifiable yes/no question about a future or verifiable event
2. Objectively resolvable — not based on personal opinion or subjective judgment
3. Clear enough that two independent observers would agree on the outcome
4. Not nonsensical, trivial, or a test message

Respond with JSON: {"valid": true/false, "reason": "brief explanation"}`,
        },
        { role: 'user', content: prediction },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { valid: false, reason: 'Validation failed' };
    return JSON.parse(content);
  } catch {
    // If LLM validation fails, let it through rather than blocking
    return { valid: true, reason: '' };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prediction, stakeAmount, deadline, challengeWindow } = body;

    if (!prediction || typeof prediction !== 'string') {
      return NextResponse.json({ error: 'prediction is required' }, { status: 400 });
    }

    // LLM validation gate
    const validation = await validatePrediction(prediction);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason || 'This doesn\'t look like a valid prediction. Please submit a specific, verifiable yes/no question.' },
        { status: 422 },
      );
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
        challengeWindow: challengeWindow || 600,
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

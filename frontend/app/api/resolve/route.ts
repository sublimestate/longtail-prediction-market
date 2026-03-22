import { NextResponse } from 'next/server';
import { getEscrowState } from '@/lib/contracts';
import { isAddress, type Address } from 'viem';

const OPENSERV_API = 'https://api.openserv.ai';
const RESOLUTION_AGENT_ID = Number(process.env.RESOLUTION_AGENT_ID || '4032');
const RESOLUTION_WORKSPACE_ID = Number(process.env.RESOLUTION_WORKSPACE_ID || '13042');

export async function POST(request: Request) {
  try {
    const { escrowAddress } = await request.json();

    if (!escrowAddress || !isAddress(escrowAddress)) {
      return NextResponse.json({ error: 'Valid escrow address required' }, { status: 400 });
    }

    const apiKey = process.env.OPENSERV_USER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENSERV_USER_API_KEY not configured' }, { status: 500 });
    }

    // Read on-chain state
    const state = await getEscrowState(escrowAddress as Address);

    if (state.state !== 'Funded') {
      return NextResponse.json(
        { error: `Escrow is in state "${state.state}" — must be "Funded" to resolve` },
        { status: 422 },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < state.deadline) {
      return NextResponse.json(
        { error: `Deadline not reached yet. ${Math.ceil((state.deadline - now) / 60)} minutes remaining.` },
        { status: 422 },
      );
    }

    // Build prediction spec matching what the resolution agent expects
    const predictionSpec = JSON.stringify({
      description: state.description,
      deadline: state.deadline,
      escrowAddress: state.escrowAddress,
      stakeAmount: state.stakeAmount,
      challengeWindow: state.challengeWindow,
      partyYes: state.partyYes,
      partyNo: state.partyNo,
    });

    const headers = {
      'Content-Type': 'application/json',
      'x-openserv-key': apiKey,
    };

    // Add a task to the existing resolution agent workspace
    const taskResp = await fetch(`${OPENSERV_API}/workspaces/${RESOLUTION_WORKSPACE_ID}/task`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        assignee: RESOLUTION_AGENT_ID,
        description: 'Resolve prediction via jury',
        body: `You MUST call the resolve-prediction tool. Pass the following as the prediction argument (as a JSON string): ${predictionSpec}. The tool will run a 3-member jury and submit the resolution on-chain. Return the tool output verbatim.`,
        input: predictionSpec,
        outputOptions: {
          default: {
            name: 'Resolution Result',
            type: 'text',
            instructions: 'Complete the resolution and provide the result',
          },
        },
        dependencies: [],
      }),
    });

    if (!taskResp.ok) {
      const text = await taskResp.text();
      return NextResponse.json({ error: `Failed to create task: ${text}` }, { status: 502 });
    }

    const task = await taskResp.json();

    return NextResponse.json({
      success: true,
      message: 'Resolution dispatched to agent',
      workspaceId: RESOLUTION_WORKSPACE_ID,
      taskId: task.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to dispatch resolution' }, { status: 500 });
  }
}

import { spawn, type ChildProcess } from 'child_process';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

const agents = [
  { name: 'Market Maker', path: 'src/market-maker/index.ts' },
  { name: 'Contract Deployer', path: 'src/contract-deployer/index.ts' },
  { name: 'Resolution', path: 'src/resolution/index.ts' },
];

const processes: ChildProcess[] = [];

function startAgent(name: string, path: string): ChildProcess {
  const fullPath = resolve(import.meta.dirname, '..', path);
  const proc = spawn('npx', ['tsx', fullPath], {
    stdio: 'pipe',
    env: { ...process.env },
    cwd: resolve(import.meta.dirname, '../..'),
  });

  proc.stdout?.on('data', (data: Buffer) => {
    console.log(`[${name}] ${data.toString().trim()}`);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    console.error(`[${name}] ${data.toString().trim()}`);
  });

  proc.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
  });

  return proc;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startAll() {
  console.log('Starting all prediction market agents...\n');
  console.log('Each agent will self-provision via @openserv-labs/client on first run.\n');
  console.log('Staggering starts to avoid SIWE auth race conditions.\n');

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    if (i > 0) {
      console.log(`Waiting 8s before starting ${agent.name}...`);
      await sleep(8000);
    }
    const proc = startAgent(agent.name, agent.path);
    processes.push(proc);
    console.log(`Started ${agent.name} agent`);
  }

  console.log('\nAll agents started. Press Ctrl+C to stop.\n');
}

startAll();

process.on('SIGINT', () => {
  console.log('\nShutting down all agents...');
  for (const proc of processes) {
    proc.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  for (const proc of processes) {
    proc.kill('SIGTERM');
  }
  process.exit(0);
});

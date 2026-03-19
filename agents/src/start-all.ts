import { spawn, type ChildProcess } from 'child_process';
import { resolve } from 'path';

const agents = [
  { name: 'Market Maker', path: 'src/market-maker/index.ts' },
  { name: 'Matchmaker', path: 'src/matchmaker/index.ts' },
  { name: 'Contract Deployer', path: 'src/contract-deployer/index.ts' },
  { name: 'Resolution', path: 'src/resolution/index.ts' },
];

const processes: ChildProcess[] = [];

function startAgent(name: string, path: string): ChildProcess {
  const fullPath = resolve(import.meta.dirname, '..', path);
  const proc = spawn('npx', ['tsx', fullPath], {
    stdio: 'pipe',
    env: process.env,
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

console.log('Starting all prediction market agents...\n');

for (const agent of agents) {
  const proc = startAgent(agent.name, agent.path);
  processes.push(proc);
  console.log(`Started ${agent.name} agent`);
}

console.log('\nAll agents started. Press Ctrl+C to stop.\n');

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

#!/usr/bin/env -S npx tsx
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertOwner, identity, localUrl, OWNER_LABEL } from '../../../prisma/local-database';
import { isLocalDatabaseUrl } from '../../../prisma/write-guard';

type State = { folder: string; port: number; pid?: number; birth?: string; container?: string };
const shell = (cmd: string, args: string[]) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { throw new Error(`${cmd} ${args[0]} failed; check dependencies and Docker. Output withheld to protect environment values.`); }
};
const stat = (pid: number) => readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
const birth = (pid: number) => stat(pid)[19];
const group = (pid: number) => Number(stat(pid)[2]);
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const ids = (name: string) => shell('docker', ['ps', '-aq', '--no-trunc', '--filter', `name=^/${name}$`]);

export function checkDatabase(env: Record<string, string>, expected: string) {
  if (!isLocalDatabaseUrl(env.DATABASE_URL ?? '')) throw new Error('Doctor refused: database is not local.');
  if (env.DATABASE_URL !== expected || env.DIRECT_URL !== expected || env.DB_TARGET !== 'local' || env.NODE_ENV !== 'development') {
    throw new Error('Doctor refused: not this folder’s development database.');
  }
}
function containerFor(state: State) {
  const { name, owner } = identity(state.folder);
  const id = ids(name);
  if (!id || (state.container && id !== state.container)) throw new Error('Owned database is missing or replaced.');
  const container = JSON.parse(shell('docker', ['inspect', id]))[0];
  assertOwner(container.Config.Labels, owner);
  return container;
}
function checkProcess(state: State) {
  if (!state.pid || birth(state.pid) !== state.birth || group(state.pid) !== state.pid || realpathSync(`/proc/${state.pid}/cwd`) !== state.folder) {
    throw new Error('Server identity changed; refusing to drive or kill it.');
  }
}
async function doctor(state: State) {
  checkProcess(state);
  const container = containerFor(state);
  const bindings = container.NetworkSettings.Ports['5432/tcp'];
  if (!container.State.Running || bindings?.length !== 1 || bindings[0].HostIp !== '127.0.0.1') throw new Error('Database is not loopback-only and running.');
  const listeners = shell('ss', ['-ltnp', `sport = :${state.port}`]);
  const pids = [...listeners.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
  if (!pids.length) throw new Error('No identifiable server listener.');
  for (const pid of pids) {
    if (group(pid) !== state.pid || realpathSync(`/proc/${pid}/cwd`) !== state.folder) throw new Error('Port belongs to another server.');
    // Read only process environment, never settings files; never log credentials.
    const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map((entry) => {
      const at = entry.indexOf('='); return [entry.slice(0, at), entry.slice(at + 1)];
    }));
    checkDatabase(env, localUrl(bindings[0].HostPort));
  }
  const reply = await fetch(`http://127.0.0.1:${state.port}/dev/session?as=invalid`, { redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  if (reply.status !== 400 || !(await reply.text()).includes('as must be one of')) throw new Error('Development session route is not answering correctly.');
  console.log(`Doctor PASS: this folder’s server and local database; http://127.0.0.1:${state.port}`);
}
async function main(action: string, evidence: string) {
  if (!evidence) throw new Error('Pass an absolute mktemp evidence directory.');
  const folder = realpathSync(process.cwd());
  const dir = realpathSync(evidence);
  if (dir === folder || dir.startsWith(`${folder}/`)) throw new Error('Evidence must be outside the checkout.');
  const file = resolve(dir, 'run.json');
  const { name, owner } = identity(folder);
  if (action === 'launch') {
    if (ids(name)) throw new Error('This folder already has a database; use a fresh worktree. Nothing reset.');
    const port = await new Promise<number>((done, reject) => {
      const socket = createServer(); socket.once('error', reject);
      socket.listen(0, '127.0.0.1', () => { const address = socket.address() as { port: number }; socket.close(() => done(address.port)); });
    });
    const state: State = { folder, port };
    const save = () => writeFileSync(file, JSON.stringify(state));
    // Exclusive state creation prevents accidentally replacing a previous run's ownership record.
    writeFileSync(file, JSON.stringify(state), { flag: 'wx' });
    shell('npm', ['run', 'db:local']);
    state.container = containerFor(state).Id; save();
    const log = openSync(resolve(dir, 'server.log'), 'a');
    const child = spawn('npm', ['run', 'dev:local', '--', '--hostname', '127.0.0.1', '--port', String(port)], { detached: true, stdio: ['ignore', log, log] });
    closeSync(log);
    await new Promise<void>((done, reject) => { child.once('spawn', done); child.once('error', reject); });
    state.pid = child.pid!; state.birth = birth(state.pid); save(); child.unref();
    console.log(`Started owned server group ${state.pid}; evidence ${dir}`);
    for (let attempt = 0; attempt < 60; attempt++) {
      try { await doctor(state); return; } catch { await sleep(1000); }
    }
    throw new Error('Server did not pass Doctor. Inspect server.log; run cleanup even after a failed launch.');
  }
  const state: State = JSON.parse(readFileSync(file, 'utf8'));
  if (state.folder !== folder) throw new Error('Run belongs to another checkout.');
  if (action === 'doctor') return doctor(state);
  if (action !== 'cleanup') throw new Error('Use launch, doctor or cleanup.');
  if (state.pid) {
    let alive = true;
    try { process.kill(-state.pid, 0); } catch { alive = false; }
    if (alive) {
      checkProcess(state); process.kill(-state.pid, 'SIGTERM');
      for (let attempt = 0; attempt < 100; attempt++) {
        try { process.kill(-state.pid, 0); await sleep(100); } catch { alive = false; break; }
      }
      if (alive) throw new Error('Server group has not exited; database retained. Investigate without killing by name.');
    }
  }
  if (ids(name)) {
    if (!state.container) throw new Error('No recorded database ID; refusing removal.');
    const container = containerFor(state);
    assertOwner(container.Config.Labels, owner);
    console.log(shell('npm', ['run', 'db:local:down']));
  }
  if (ids(name)) throw new Error('Database still exists.');
  console.log(`Cleanup PASS: owned server group gone; database gone (${OWNER_LABEL}); evidence retained at ${dir}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2], process.argv[3]).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Verification helper failed.');
    console.error('Check run state and server.log; run cleanup after launch failures.'); process.exitCode = 1;
  });
}

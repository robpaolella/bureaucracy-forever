import { createHash, randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isLocalDatabaseUrl } from './write-guard';

// PostgreSQL 17 is supported by Neon. Pin the major rather than following latest.
export const IMAGE = 'postgres:17';
export const OWNER_LABEL = 'com.bureauguild.local-database';
export function identity(folder: string) {
  const owner = createHash('sha256').update(resolve(folder)).digest('hex');
  const slug = basename(folder).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 39) || 'worker';
  return { owner, name: `bureau-${slug}-${owner.slice(0, 16)}` };
}
export function assertOwner(labels: Record<string, string | undefined> | null, owner: string) {
  if (labels?.[OWNER_LABEL] !== owner) throw new Error('Refusing to use or remove a container not created for this folder.');
}
export function localUrl(port: string) {
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Docker did not provide a valid local port.');
  return checkedUrl(`postgresql://worker:worker@127.0.0.1:${Number(port)}/bureau`);
}
export function checkedUrl(url: string) {
  if (!isLocalDatabaseUrl(url)) throw new Error('Refusing a non-local database URL.');
  return url;
}
export function childEnvironment(url: string, inherited: Record<string, string | undefined> = process.env): NodeJS.ProcessEnv {
  return { ...inherited, DATABASE_URL: checkedUrl(url), DIRECT_URL: checkedUrl(url), DB_TARGET: 'local',
    // dotenv 18 accepts an inherited override flag; keep our local URLs authoritative.
    DOTENV_OVERRIDE: 'false', DOTENV_CONFIG_OVERRIDE: 'false',
    NODE_ENV: 'development', AUTH_SECRET: randomBytes(32).toString('hex'), LOOT_ENABLED: 'true',
    AUTH_DISCORD_ID: '', AUTH_DISCORD_SECRET: '', DISCORD_CLIENT_ID: '', DISCORD_CLIENT_SECRET: '',
    DISCORD_BOT_TOKEN: '', DISCORD_GUILD_ID: '', DISCORD_ROLE_OFFICER: '', DISCORD_ROLE_MEMBER: '',
    DISCORD_ROLE_GUILD_MASTER: '', DISCORD_ROLE_ADMINISTRATOR: '', BOT_SHARED_SECRET: '',
    AUTH_URL: '', AUTH_TRUST_HOST: 'true' };
}
function docker(...args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 120_000 });
  if (result.error || result.status !== 0) throw new Error(`Docker could not complete ${args[0]}. Check that Docker is running and its image/port is available.`);
  return result.stdout.trim();
}
type Container = { Id: string; Config: { Labels: Record<string, string> | null }; State: { Running: boolean }; NetworkSettings: { Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null> } };
function inspect(name: string): Container | undefined {
  const ids = docker('container', 'ls', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}');
  if (!ids) return undefined;
  return (JSON.parse(docker('container', 'inspect', name)) as Container[])[0];
}
function urlFor(container: Container): string {
  const bindings = container.NetworkSettings.Ports['5432/tcp'];
  if (bindings?.length !== 1 || bindings[0].HostIp !== '127.0.0.1') throw new Error('Container must expose Postgres only on the local loopback address.');
  return localUrl(bindings[0].HostPort);
}
async function run(command: string, args: string[], env: NodeJS.ProcessEnv, interruptible = false) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' });
    const forward = (signal: NodeJS.Signals) => child.kill(signal);
    const interrupt = () => forward('SIGINT');
    const terminate = () => forward('SIGTERM');
    process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
    const clean = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); };
    child.once('error', () => { clean(); reject(new Error(`Could not start ${command}. Run npm install first.`)); });
    child.once('exit', (code, signal) => { clean(); if (code === 0 || (interruptible && (signal === 'SIGINT' || signal === 'SIGTERM'))) resolve(); else reject(new Error(`${command} failed; see its output above.`)); });
  });
}
export async function main(action: string | undefined) {
  if (!['up', 'dev', 'down'].includes(action ?? '')) throw new Error('Use db:local, dev:local or db:local:down.');
  const { name, owner } = identity(realpathSync(process.cwd()));
  docker('info', '--format', '{{.ServerVersion}}');
  let container = inspect(name);
  if (container) assertOwner(container.Config.Labels, owner);
  if (action === 'down') {
    if (container) { docker('rm', '-f', '-v', container.Id); console.log(`Removed ${name} and its throwaway data.`); }
    else console.log('No local database exists for this folder.');
    return;
  }
  if (action === 'dev') {
    if (!container?.State.Running) throw new Error('Run npm run db:local first to start this folder’s database.');
    await run('node_modules/.bin/next', ['dev', ...process.argv.slice(3)], childEnvironment(urlFor(container)), true);
    return;
  }
  let created = false;
  try {
    if (!container) {
      docker('create', '--name', name, '--label', `${OWNER_LABEL}=${owner}`, '-p', '127.0.0.1::5432',
        '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_DB=bureau', IMAGE);
      created = true;
      docker('start', name);
      console.log(`Created ${name} (${IMAGE}).`);
    } else {
      if (!container.State.Running) docker('start', container.Id);
      console.log(`Reusing ${name}; resetting sample data.`);
    }
    container = inspect(name);
    if (!container) throw new Error('The local container disappeared.');
    assertOwner(container.Config.Labels, owner);
    const url = urlFor(container);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const result = spawnSync('docker', ['exec', container.Id, 'pg_isready', '-h', '127.0.0.1', '-U', 'worker', '-d', 'bureau'], { stdio: 'ignore', timeout: 3000 });
      if (result.status === 0) { ready = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('Postgres did not become ready within one minute.');
    const env = childEnvironment(url);
    await run('node_modules/.bin/prisma', ['migrate', 'deploy'], env);
    await run('node_modules/.bin/prisma', ['db', 'seed'], env);
    console.log(`Local database ready on port ${new URL(url).port}. Start the site with npm run dev:local.`);
  } catch (error) {
    // Only a newly created database is disposable on setup failure; never remove reused data.
    if (created) {
      const failed = inspect(name);
      if (failed) { assertOwner(failed.Config.Labels, owner); docker('rm', '-f', '-v', failed.Id); }
    }
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2]).catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Local database command failed.'); process.exitCode = 1; });
}

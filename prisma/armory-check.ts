/**
 * One-off live check of Blizzard's WoW Forever API with Robert's keys (#565, #568).
 *
 *   npx tsx prisma/armory-check.ts --settings <file> --key-test   prints `works` or `doesn't work`
 *   npx tsx prisma/armory-check.ts --settings <file> --lookup     status and level for two names
 *
 * The settings file is JSON: { "clientId", "clientSecret", "testCharacter": "First Last" }.
 * `--lookup` looks up its testCharacter and a fixed made-up name, so one should answer 200 with
 * a level and the other 404. The output never holds a name, key, token or error text: this
 * repo and its PRs are public. Only reads; one token request plus at most two lookups a run.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createArmoryClient, type ArmoryResult } from '@/lib/armory';

/** Not a real character: two made-up words that fit the site's name rule. */
export const MADE_UP_NAME = 'Qzxvbrel Wyxqtorn';

type Deps = { readFile: (path: string) => Promise<string>; fetch?: typeof fetch; print: (line: string) => void };

const USAGE = 'usage: armory-check.ts --settings <file> (--key-test | --lookup)';

function describe(result: ArmoryResult): string {
  const status = result.status ?? 'none';
  return `status ${status}, level ${result.kind === 'found' ? result.level : 'none'}`;
}

export async function runArmoryCheck(args: string[], deps: Deps): Promise<number> {
  const at = args.indexOf('--settings');
  const path = at >= 0 ? args[at + 1] : undefined;
  const mode = args.includes('--key-test') ? 'key-test' : args.includes('--lookup') ? 'lookup' : null;
  if (!path || path.startsWith('--') || !mode) { deps.print(USAGE); return 2; }

  let clientId: unknown, clientSecret: unknown, testCharacter: unknown;
  try {
    ({ clientId, clientSecret, testCharacter } = JSON.parse(await deps.readFile(path)) as Record<string, unknown>);
  } catch {
    // Never echo the error: a JSON parse message can quote the file.
  }
  if (typeof clientId !== 'string' || !clientId || typeof clientSecret !== 'string' || !clientSecret) {
    deps.print(mode === 'key-test' ? "doesn't work" : 'settings file unreadable or missing its keys');
    return 1;
  }
  const client = createArmoryClient({ clientId, clientSecret }, { fetch: deps.fetch });

  if (mode === 'key-test') {
    const works = await client.checkKeys();
    deps.print(works ? 'works' : "doesn't work");
    return works ? 0 : 1;
  }

  if (typeof testCharacter !== 'string' || !testCharacter.trim()) {
    deps.print('settings file has no testCharacter');
    return 1;
  }
  if (!(await client.checkKeys())) { deps.print("keys don't work"); return 1; }
  const test = await client.lookupLevel(testCharacter);
  deps.print(`test character: ${describe(test)}`);
  const madeUp = await client.lookupLevel(MADE_UP_NAME);
  deps.print(`made-up name: ${describe(madeUp)}`);
  return test.kind === 'found' && madeUp.kind === 'not-found' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runArmoryCheck(process.argv.slice(2), { readFile: (p) => readFile(p, 'utf8'), print: (line) => console.log(line) })
    .then((code) => { process.exitCode = code; }, () => { console.log('check failed'); process.exitCode = 1; });
}

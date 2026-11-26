import { describe, expect, it, vi } from 'vitest';
import { ARMORY_TOKEN_URL, profileUrl } from '@/lib/armory';
import { json, notFoundReply, profileReply, SAMPLE_TOKEN, tokenReply } from '@/lib/armory.fixtures';
import { MADE_UP_NAME, runArmoryCheck } from './armory-check';

const SECRET = 'sample-client-secret';
const CLIENT_ID = 'sample-client-id';
const TEST_CHARACTER = 'Sample Name';
const settingsFile = JSON.stringify({ clientId: CLIENT_ID, clientSecret: SECRET, testCharacter: TEST_CHARACTER });

function run(args: string[], { file = settingsFile, token = () => json(200, tokenReply) } = {}) {
  const lines: string[] = [];
  const readFile = vi.fn(async () => file);
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(init?.method ?? 'GET').toBe(String(url) === ARMORY_TOKEN_URL ? 'POST' : 'GET');
    if (String(url) === ARMORY_TOKEN_URL) return token();
    return String(url) === profileUrl(TEST_CHARACTER) ? json(200, profileReply) : json(404, notFoundReply);
  });
  return runArmoryCheck(args, { readFile, fetch, print: (line) => lines.push(line) }).then((code) => ({ code, lines, readFile, fetch }));
}

/** Nothing secret or personal may reach the output. */
function expectClean(lines: string[]) {
  const out = lines.join('\n');
  for (const word of [SECRET, CLIENT_ID, SAMPLE_TOKEN, TEST_CHARACTER, MADE_UP_NAME, 'sample-name', 'qzxvbrel']) {
    expect(out.toLowerCase()).not.toContain(word.toLowerCase());
  }
}

describe('armory-check --key-test', () => {
  it('prints works with good keys, reading the file named by --settings', async () => {
    const { code, lines, readFile, fetch } = await run(['--settings', '/tmp/blizzard.json', '--key-test']);
    expect({ code, lines }).toEqual({ code: 0, lines: ['works'] });
    expect(readFile).toHaveBeenCalledWith('/tmp/blizzard.json');
    expect(fetch).toHaveBeenCalledTimes(1);
    expectClean(lines);
  });

  it("prints doesn't work for refused keys or a bad file, without its content", async () => {
    const refused = await run(['--settings', 'f', '--key-test'], { token: () => json(401, { error: 'invalid_client' }) });
    expect(refused.lines).toEqual(["doesn't work"]);
    const broken = await run(['--settings', 'f', '--key-test'], { file: `{ "clientSecret": "${SECRET}"` });
    expect(broken.lines).toEqual(["doesn't work"]);
    expect(broken.fetch).not.toHaveBeenCalled();
    expectClean([...refused.lines, ...broken.lines]);
  });
});

describe('armory-check --lookup', () => {
  it('prints only statuses and levels for the test character and the made-up name', async () => {
    const { code, lines, fetch } = await run(['--settings', 'f', '--lookup']);
    expect(lines).toEqual(['test character: status 200, level 58', 'made-up name: status 404, level none']);
    expect(code).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(3);
    expectClean(lines);
  });

  it('needs a testCharacter', async () => {
    const { code, lines } = await run(['--settings', 'f', '--lookup'], { file: JSON.stringify({ clientId: CLIENT_ID, clientSecret: SECRET }) });
    expect({ code, lines }).toEqual({ code: 1, lines: ['settings file has no testCharacter'] });
  });
});

it('prints usage without a settings path or a mode', async () => {
  expect((await run(['--key-test'])).code).toBe(2);
  expect((await run(['--settings', 'f'])).code).toBe(2);
});

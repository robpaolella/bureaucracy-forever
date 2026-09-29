import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/lib/generated/prisma/client';

const mocks = vi.hoisted(() => ({ session: null as { role: string } | null, create: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/db', () => ({ db: { raidTemplate: { create: mocks.create } } }));

import { POST } from './route';

const BODY = { name: 'Blackwing Lair', short: 'BWL', size: 40, durationMin: 180, requirements: { tank: 4, healer: 10, melee: 12, ranged: 14 }, active: true };
const request = (body: unknown) => new Request('https://example.test/api/raid-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/raid-templates', () => {
  beforeEach(() => {
    mocks.session = { role: 'officer' };
    mocks.create.mockReset().mockResolvedValue({ id: 't1', name: 'Blackwing Lair' });
  });

  it('creates a template for an officer', async () => {
    const res = await POST(request(BODY));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 't1', name: 'Blackwing Lair' });
    expect(mocks.create).toHaveBeenCalledWith({ data: BODY, select: { id: true, name: true } });
  });

  it('writes the trimmed names and refuses a body that is not JSON', async () => {
    await POST(request({ ...BODY, name: '  Blackwing Lair  ', short: ' BWL ' }));
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ name: 'Blackwing Lair', short: 'BWL' });
    const bad = await POST(new Request('https://example.test/api/raid-templates', { method: 'POST', body: '{' }));
    expect(bad.status).toBe(400);
  });

  it('refuses anyone but an officer', async () => {
    mocks.session = null;
    expect((await POST(request(BODY))).status).toBe(401);
    mocks.session = { role: 'member' };
    expect((await POST(request(BODY))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects requirements that do not add up to the size', async () => {
    const res = await POST(request({ ...BODY, requirements: { tank: 1, healer: 1, melee: 1, ranged: 1 } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'The four requirements must add up to 40.' });
  });

  it('answers 409 when the name is taken', async () => {
    mocks.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }));
    const res = await POST(request(BODY));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'A template with that name exists.' });
  });
});

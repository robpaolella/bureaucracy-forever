/**
 * Officer decisions on an application (docs/04 § Application detail § Actions) and the
 * private notes beneath it. Pure parsing shared by the routes and their tests.
 */
export type Decision = { kind: 'status'; status: 'accepted' | 'declined' } | { kind: 'path'; path: 'social' };

export type ParsedDecision = { ok: true; value: Decision } | { ok: false; error: string };

export function parseDecision(body: unknown): ParsedDecision {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (b.status === 'accepted' || b.status === 'declined') return { ok: true, value: { kind: 'status', status: b.status } };
  if (b.path === 'social') return { ok: true, value: { kind: 'path', path: 'social' } };
  return { ok: false, error: 'Send status "accepted" or "declined", or path "social".' };
}

export const NOTE_MAX = 1000;

export type ParsedNote = { ok: true; body: string } | { ok: false; error: string };

export function parseNote(body: unknown): ParsedNote {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = typeof b.body === 'string' ? b.body.trim() : '';
  if (!text) return { ok: false, error: 'Write the note first.' };
  if (text.length > NOTE_MAX) return { ok: false, error: `Keep a note under ${NOTE_MAX} characters.` };
  return { ok: true, body: text };
}

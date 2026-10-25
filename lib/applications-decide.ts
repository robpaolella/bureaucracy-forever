/**
 * Officer decisions on an application (docs/04 § Application detail § Actions) and the
 * private notes beneath it. Pure parsing shared by the routes and their tests.
 */
export type DecisionMessage = { kind: 'standard' } | { kind: 'custom'; text: string } | { kind: 'none' };
export type AcceptAs = 'raider' | 'social';
/** What goes with a status (SYNC-SPEC §4, Decision request): `message` on Decline, `acceptAs` on Accept. Omitted means today's behaviour. */
export type DecisionChoice = { message?: DecisionMessage; acceptAs?: AcceptAs };

export type Decision = ({ kind: 'status'; status: 'accepted' | 'declined' } & DecisionChoice) | { kind: 'path'; path: 'social' };

export type ParsedDecision = { ok: true; value: Decision } | { ok: false; error: string };

/** Longest custom message, in Unicode code points (never UTF-16 units or bytes), after trimming. */
export const DECISION_MESSAGE_MAX = 2000;

export type ParsedChoice = { ok: true; value: DecisionChoice } | { ok: false; error: string };

/** The optional `message` and `acceptAs` of a decision, shared by the web and bot routes. Checked before any state. */
export function parseDecisionChoice(status: 'accepted' | 'declined', b: Record<string, unknown>): ParsedChoice {
  const { message, acceptAs } = b;
  if (message !== undefined && status === 'accepted') return { ok: false, error: 'A message goes only with a decline.' };
  if (acceptAs !== undefined && status === 'declined') return { ok: false, error: 'Accept as goes only with an accept.' };
  if (acceptAs !== undefined) {
    if (acceptAs !== 'raider' && acceptAs !== 'social') return { ok: false, error: 'Accept as "raider" or "social".' };
    return { ok: true, value: { acceptAs } };
  }
  if (message === undefined) return { ok: true, value: {} };
  if (!message || typeof message !== 'object' || Array.isArray(message)) return { ok: false, error: 'Send the message as { kind, text }.' };
  const { kind, text } = message as Record<string, unknown>;
  if (kind === 'standard' || kind === 'none') {
    if (text !== undefined) return { ok: false, error: `A ${kind} message takes no text.` };
    return { ok: true, value: { message: { kind } } };
  }
  if (kind !== 'custom') return { ok: false, error: 'Message kind must be "standard", "custom" or "none".' };
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return { ok: false, error: 'Write the message first.' };
  if ([...trimmed].length > DECISION_MESSAGE_MAX) return { ok: false, error: `Keep the message to ${DECISION_MESSAGE_MAX.toLocaleString('en-US')} characters.` };
  return { ok: true, value: { message: { kind: 'custom', text: trimmed } } };
}

export function parseDecision(body: unknown): ParsedDecision {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (b.status === 'accepted' || b.status === 'declined') {
    const choice = parseDecisionChoice(b.status, b);
    return choice.ok ? { ok: true, value: { kind: 'status', status: b.status, ...choice.value } } : choice;
  }
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

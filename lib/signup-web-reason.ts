/**
 * The refusal text the site shows. The bot shows `REASONS` as is (SYNC-SPEC §7); only the
 * locked text differs, because "change answers on the web" is wrong for someone already on it.
 */
import { RESPONSE_NOTES } from '@/content/raid';
import { REASONS } from '@/lib/signup-rules';

export function webReason(reason: string): string {
  return reason === REASONS.locked ? RESPONSE_NOTES.locked : reason;
}

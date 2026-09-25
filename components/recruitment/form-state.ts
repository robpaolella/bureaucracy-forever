/** Shared between the server action and the client form. Kept out of the 'use server' module, which may only export async functions. */

export type ApplicationPath = 'raider' | 'social';

export type ApplicationState = {
  ok: boolean;
  /** Field-level errors, keyed by input name. */
  errors: Record<string, string>;
  /** Whole-form message, e.g. the not-open notice. */
  message?: string;
};

export const INITIAL_STATE: ApplicationState = { ok: false, errors: {} };

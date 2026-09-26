'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, CONTROL, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { NOTE_MAX } from '@/lib/applications-decide';
import { SAVE_FAILED } from '@/content/calendar';
import { NOTE_COMPOSER } from '@/content/applications';

/** The 44px composer under the officer notes (docs/04 § Application detail). Posts, clears, refreshes. */
export function NoteComposer({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const setToast = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }), credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      setBody('');
      setToast({ tone: 'ok', title: NOTE_COMPOSER.posted });
      router.refresh();
    } catch {
      setToast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-stretch gap-2" aria-label={NOTE_COMPOSER.label}>
      <input
        type="text"
        value={body}
        maxLength={NOTE_MAX}
        onChange={(e) => setBody(e.target.value)}
        placeholder={NOTE_COMPOSER.placeholder}
        aria-label={NOTE_COMPOSER.label}
        autoComplete="off"
        className={cn(CONTROL, 'h-11 flex-1 px-3.5')}
      />
      <Button type="submit" variant="secondary" size="sm" loading={saving} disabled={!body.trim()}>
        {NOTE_COMPOSER.post}
      </Button>
    </form>
  );
}

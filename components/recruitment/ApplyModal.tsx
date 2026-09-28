'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { checkApplyGate } from '@/app/(site)/apply/actions';
import { ApplicationForm } from '@/components/recruitment/ApplicationForm';
import type { ApplicationPath, ApplyGate } from '@/components/recruitment/form-state';
import { Button, ButtonLink, buttonClassName, type ButtonSize, type ButtonVariant } from '@/components/ui';
import { APPLY_GATE, FORM } from '@/content/recruitment';
import { cn } from '@/lib/cn';
import { DISCORD_INVITE_URL, LOGIN_URL } from '@/lib/config';

/** `?apply=raider|social` on any page opens the modal on load: the sign-in comes back with it. */
const APPLY_PARAM = 'apply';
/** Where a successful submit lands (the server action redirects there). */
const SUBMITTED_PATH = '/recruitment/submitted';

const OpenCtx = createContext<((path: ApplicationPath) => void) | null>(null);

const asPath = (v: string | null): ApplicationPath | null => (v === 'raider' || v === 'social' ? v : null);

/**
 * The application form as a modal over whatever page the applicant is on, behind the same
 * gate as /apply: sign in, then be in the server, then the form. A successful submit
 * redirects to /recruitment/submitted like the page does; the route change closes the modal.
 * Closing keeps what was typed until the applicant navigates away.
 */
export function ApplyModalProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Nothing renders inside the dialog until the first open; after that it stays, so a closed form keeps its answers.
  const [touched, setTouched] = useState(false);
  const [gate, setGate] = useState<ApplyGate | null>(null);
  // The path the form was mounted with, and a counter that remounts it after a submit.
  const [formPath, setFormPath] = useState<ApplicationPath>('raider');
  const [epoch, setEpoch] = useState(0);
  const [returnTo, setReturnTo] = useState('/');
  const request = useRef(0);

  const check = useCallback(
    (path: ApplicationPath) => {
      const id = ++request.current;
      setGate(null);
      checkApplyGate()
        .then((g) => {
          if (id === request.current) setGate(g);
        })
        // The check itself failed (offline, a deploy mid-flight): the page shows the same gate.
        .catch(() => router.push(`/apply?path=${path}`));
    },
    [router],
  );

  const reveal = useCallback((path: ApplicationPath) => {
    const url = new URL(window.location.href);
    url.searchParams.set(APPLY_PARAM, path);
    setReturnTo(url.pathname + url.search);
    setFormPath(path);
    setOpen(true);
    setTouched(true);
  }, []);

  const openWith = useCallback(
    (path: ApplicationPath) => {
      reveal(path);
      // A signed-in member keeps their form; anyone else is asked again, since they may
      // have signed in or joined the server in another tab.
      if (gate?.kind !== 'form') check(path);
    },
    [gate, check, reveal],
  );

  // Back from the Discord sign-in with ?apply=: open once the gate is known, and tidy the
  // address then (not before, so a Strict Mode re-run still sees the parameter).
  useEffect(() => {
    const path = asPath(new URL(window.location.href).searchParams.get(APPLY_PARAM));
    if (!path) return;
    let live = true;
    const id = ++request.current;
    checkApplyGate()
      .then((g) => {
        if (!live || id !== request.current) return;
        const url = new URL(window.location.href);
        url.searchParams.delete(APPLY_PARAM);
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        reveal(path);
        setGate(g);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [reveal]);

  // Any navigation (the submitted page, the loot rules link inside the form) closes it. A
  // draft survives the loot rules; only a submitted application starts the next form fresh.
  // Adjusted during render, as React recommends for resets driven by a changed value.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
    if (pathname.startsWith(SUBMITTED_PATH)) setEpoch((n) => n + 1);
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    if (!open) return;
    // The page behind stays put while the form scrolls.
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = before;
    };
  }, [open]);

  const close = () => setOpen(false);
  const showForm = gate?.kind === 'form';

  return (
    <OpenCtx.Provider value={openWith}>
      {children}
      <dialog
        ref={ref}
        aria-label={FORM.title}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          // Only the backdrop is the dialog element itself; clicks inside land on the panel.
          if (e.target === e.currentTarget) close();
        }}
        className={cn(
          'm-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] overflow-y-auto overscroll-contain rounded-card bg-transparent p-0 text-fg shadow-modal',
          showForm ? 'max-w-[880px]' : 'max-w-[520px]',
        )}
      >
        {touched && (
          <div className="relative">
            <div className="sticky top-0 z-10 flex h-0 justify-end">
              <Button variant="ghost" iconOnly aria-label="Close" onClick={close} className="mr-2 mt-2 bg-ink-850 md:mr-3 md:mt-3">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </Button>
            </div>
            {showForm ? (
              <ApplicationForm key={`${formPath}:${epoch}`} discordHandle={gate.name} initialPath={formPath} />
            ) : (
              <GatePanel gate={gate} returnTo={returnTo} onRetry={() => check(formPath)} />
            )}
          </div>
        )}
      </dialog>
    </OpenCtx.Provider>
  );
}

function GatePanel({ gate, returnTo, onRetry }: { gate: ApplyGate | null; returnTo: string; onRetry: () => void }) {
  const copy =
    gate?.kind === 'signin'
      ? { title: APPLY_GATE.signInTitle, body: APPLY_GATE.signInBody }
      : gate?.kind === 'join'
        ? { title: APPLY_GATE.joinTitle, body: APPLY_GATE.joinBody }
        : null;
  return (
    <div className="flex flex-col items-center gap-5 rounded-card border border-line bg-ink-850 px-6 pb-8 pt-12 text-center md:px-10">
      <Image src="/brand/mark.png" alt="" width={42} height={48} className="w-10 opacity-40" />
      <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{APPLY_GATE.eyebrow}</span>
      {copy ? (
        <>
          <h2 className="font-display text-[30px] font-medium leading-[1.08] tracking-[-0.02em]">{copy.title}</h2>
          <p className="text-[15px] leading-[1.7] text-fg-2">{copy.body}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {gate?.kind === 'signin' ? (
              <>
                <ButtonLink href={`${LOGIN_URL}?back=${encodeURIComponent(returnTo)}`}>{APPLY_GATE.signIn}</ButtonLink>
                <ButtonLink href={DISCORD_INVITE_URL} variant="secondary" target="_blank" rel="noopener noreferrer">
                  {APPLY_GATE.join}
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                  {APPLY_GATE.join}
                </ButtonLink>
                <Button variant="secondary" onClick={onRetry}>
                  {APPLY_GATE.retry}
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <p role="status" className="pb-4 text-[15px] text-fg-2">
          {APPLY_GATE.checking}
        </p>
      )}
    </div>
  );
}

type ApplyLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { path: ApplicationPath };

/**
 * A link to /apply that opens the apply modal instead. It stays a real link, so a
 * middle-click, a modified click or a page without the modal still reaches the form.
 */
export function ApplyLink({ path, onClick, ...props }: ApplyLinkProps) {
  const open = useContext(OpenCtx);
  return (
    <Link
      {...props}
      href={`/apply?path=${path}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !open || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(path);
      }}
    />
  );
}

/** ApplyLink in the button look, for the "Apply to raid" and "Apply as Social" buttons. */
export function ApplyButton({
  variant,
  size,
  className,
  ...props
}: ApplyLinkProps & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <ApplyLink {...props} className={cn(buttonClassName({ variant, size }), className)} />;
}

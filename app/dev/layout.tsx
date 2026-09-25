import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

/** Every /dev page is a build aid. None of them exist in production. */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return children;
}

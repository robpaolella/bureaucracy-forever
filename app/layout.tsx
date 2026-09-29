import type { Metadata, Viewport } from 'next';
import { Archivo, Cinzel, Newsreader } from 'next/font/google';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/config';
import './globals.css';

// Three families, three jobs. Cinzel: eyebrows. Newsreader: display. Archivo: UI.
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['600'],
  display: 'swap',
  variable: '--font-cinzel',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  // Variable font: covers 400 and 500 and keeps the optical-size axis the artboards load.
  weight: 'variable',
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-newsreader',
});

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-archivo',
});

/** Dark only: tells the browser before the stylesheet loads, so the canvas never flashes white. */
export const viewport: Viewport = { colorScheme: 'dark' };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: 'website', siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION, locale: 'en_US' },
  twitter: { card: 'summary_large_image', title: SITE_NAME, description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${newsreader.variable} ${archivo.variable}`}>
      <body className="min-h-screen bg-ink-950 text-fg font-sans antialiased">{children}</body>
    </html>
  );
}

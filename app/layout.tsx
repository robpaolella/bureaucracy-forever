import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { StagingBadge } from '@/components/shell/StagingBadge';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/config';
import './fonts/fonts.css';
import './globals.css';

// Self-hosted copies of the Google Fonts files, so the build needs no network. These are
// the preloaded Latin faces; ./fonts/fonts.css adds the other character sets under the same
// family names and the size-matched fallbacks. next/font needs literal values, so the Latin
// unicode-range is repeated in each. Turbopack names each family after its constant, hence
// the capitalised names: the CSS variables come out exactly as Google's did.

// Three families, three jobs. Cinzel: eyebrows. Newsreader: display. Archivo: UI.
const Cinzel = localFont({
  src: './fonts/cinzel-600-latin.woff2',
  weight: '600',
  style: 'normal',
  declarations: [
    { prop: 'font-family', value: "'Cinzel'" },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
  display: 'swap',
  adjustFontFallback: false,
  fallback: ["'Cinzel Fallback'"],
  variable: '--font-cinzel',
});

// Variable font: covers 400 and 500 and keeps the optical-size axis the artboards load.
const Newsreader = localFont({
  src: './fonts/newsreader-latin.woff2',
  weight: '200 800',
  style: 'normal',
  declarations: [
    { prop: 'font-family', value: "'Newsreader'" },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
  display: 'swap',
  adjustFontFallback: false,
  fallback: ["'Newsreader Fallback'"],
  variable: '--font-newsreader',
});

// One variable file serves all four weights, declared one face per weight as Google does.
const Archivo = localFont({
  src: [
    { path: './fonts/archivo-latin.woff2', weight: '400' },
    { path: './fonts/archivo-latin.woff2', weight: '500' },
    { path: './fonts/archivo-latin.woff2', weight: '600' },
    { path: './fonts/archivo-latin.woff2', weight: '700' },
  ],
  style: 'normal',
  declarations: [
    { prop: 'font-family', value: "'Archivo'" },
    { prop: 'font-stretch', value: '100%' },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
  display: 'swap',
  adjustFontFallback: false,
  fallback: ["'Archivo Fallback'"],
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
    <html lang="en" className={`${Cinzel.variable} ${Newsreader.variable} ${Archivo.variable}`}>
      <body className="min-h-screen bg-ink-950 text-fg font-sans antialiased">
        {children}
        <StagingBadge />
      </body>
    </html>
  );
}

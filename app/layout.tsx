import type { Metadata } from 'next';
import { Archivo, Cinzel, Newsreader } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'Bureaucracy',
  description: 'A competitive 40-player raiding guild on WoW Forever.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${newsreader.variable} ${archivo.variable}`}>
      <body className="min-h-screen bg-ink-950 text-fg font-sans antialiased">{children}</body>
    </html>
  );
}

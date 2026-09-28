import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/config';

export const alt = 'Bureaucracy, a WoW Forever raiding guild';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The Open Graph card (docs/07 § 11: "OG cards using the tile asset"): ink field, the teal
 * tile at the left, the guild name and one line beside it. Tokens from tokens.css by value,
 * since Tailwind does not reach into ImageResponse.
 */
export default async function OpenGraphImage() {
  const tile = await readFile(join(process.cwd(), 'public', 'brand', 'tile.png'));
  const tileSrc = `data:image/png;base64,${tile.toString('base64')}`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 64, padding: '0 96px', background: '#0b0e13', color: '#e9e6df', fontFamily: 'Georgia, serif' }}>
        <img src={tileSrc} alt="" width={256} height={256} style={{ borderRadius: 32 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 22, letterSpacing: 8, textTransform: 'uppercase', color: '#d9b877', fontFamily: 'sans-serif', fontWeight: 600 }}>WoW Forever</div>
          <div style={{ fontSize: 96, lineHeight: 1, fontWeight: 500 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 30, lineHeight: 1.35, color: '#a9a7a0', fontFamily: 'sans-serif', maxWidth: 720 }}>{SITE_DESCRIPTION}</div>
        </div>
      </div>
    ),
    size,
  );
}

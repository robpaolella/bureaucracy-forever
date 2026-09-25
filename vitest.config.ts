import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'design-handover'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // `server-only` throws when imported outside RSC; tests import server modules directly.
      'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
    },
  },
});

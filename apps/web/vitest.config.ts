import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      // Cobre apenas os módulos com testes hoje (utilitários + componentes de UI
      // testados). À medida que a suíte cresce, ampliar o escopo e subir o piso.
      include: [
        'src/lib/utils.ts',
        'src/components/ui/button.tsx',
        'src/components/ui/status-badge.tsx',
      ],
      // Piso obrigatório (ratchet): a build falha se a cobertura cair abaixo disto.
      // Fixado logo abaixo do medido atual; subir conforme a suíte cresce.
      thresholds: {
        statements: 88,
        branches: 80,
        functions: 55,
        lines: 88,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@navix/contracts': resolve(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
});

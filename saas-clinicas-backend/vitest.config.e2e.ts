import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-database.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    setupFiles: ['reflect-metadata'],
    globalSetup: ['./test/global-setup.ts'],
    include: ['**/*.e2e-spec.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_ACCESS_SECRET: 'e2e-secret-with-at-least-32-characters',
      // Alto para não interferir nos testes; o limite tem teste próprio
      LOGIN_RATE_LIMIT: '1000',
    },
    // Os arquivos compartilham o mesmo banco
    fileParallelism: false,
  },
});

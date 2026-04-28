import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/integration/**/*.spec.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});

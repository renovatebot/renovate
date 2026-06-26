import { defineConfig } from 'vitest/config';

// unset any RENOVATE_* env vars to avoid tampering with the tests
for (const key of Object.keys(process.env)) {
  if (
    key.startsWith('RENOVATE_') ||
    key.startsWith('GIT_') ||
    key === 'GITHUB_TOKEN'
  ) {
    delete process.env[key];
  }
}

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

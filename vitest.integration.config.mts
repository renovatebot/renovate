import { defineConfig } from 'vitest/config';

// unset any env vars that can avoid tampering with the tests
for (const key of Object.keys(process.env)) {
  if (
    key.startsWith('RENOVATE_') ||
    key.startsWith('GIT_') ||
    key.startsWith('GITHUB_') ||
    key.startsWith('NPM_')
  ) {
    delete process.env[key];
  }
}

export default defineConfig({
  test: {
    globals: true,
    include: ['test/integration/**/*.spec.ts'],
    fileParallelism: false,
  },
});

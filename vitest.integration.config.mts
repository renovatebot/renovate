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

// prevent ryuk from reaping containers if KEEP_CONTAINERS is enabled
if (['true', '1'].includes(process.env.KEEP_CONTAINERS ?? '')) {
  process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';
}

export default defineConfig({
  test: {
    globals: true,
    include: ['test/integration/**/*.spec.ts'],
    fileParallelism: false,
  },
});

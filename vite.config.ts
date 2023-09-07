import { env } from 'node:process';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import GithubActionsReporter from 'vitest-github-actions-reporter';

const ci = !!env.CI;

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.spec.json'] })],
  test: {
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ci ? ['lcovonly', 'text'] : ['html', 'text'],
      include: [
        'lib/**/*.{js,ts,cjs,mjs,cts,mts}',
        '!lib/**/*.{d,spec}.ts',
        '!**/__fixtures__/**',
        '!**/types.ts',
      ],
    },
    reporters: ci ? ['default', new GithubActionsReporter()] : ['default'],
    restoreMocks: true,
    setupFiles: ['./test/setup.ts', './test/to-migrate.ts'],
    logHeapUsage: true,
  },
});

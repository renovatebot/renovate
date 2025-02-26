import tsconfigPaths from 'vite-tsconfig-paths';
import type { ViteUserConfig } from 'vitest/config';
import { defineConfig, mergeConfig } from 'vitest/config';
import GitHubActionsReporter from 'vitest-github-actions-reporter';
import { testShards } from './tools/test/shards';
import { normalizePattern } from './tools/test/utils';

const ci = !!process.env.CI;

/**
 * Generates Vitest config for sharded test run.
 *
 * If `TEST_SHARD` environment variable is not set,
 * it falls back to the provided config.
 *
 * Otherwise, `fallback` value is used to determine some defaults.
 */
function configureShardingOrFallbackTo(
  fallback: ViteUserConfig,
): ViteUserConfig {
  const shardKey = process.env.TEST_SHARD;
  if (!shardKey) {
    return fallback;
  }

  if (!testShards[shardKey]) {
    const keys = Object.keys(testShards).join(', ');
    throw new Error(
      `Unknown value for TEST_SHARD: ${shardKey} (possible values: ${keys})`,
    );
  }

  const include: string[] = [];

  for (const [key, { matchPaths: patterns }] of Object.entries(testShards)) {
    if (key === shardKey) {
      const testMatchPatterns = patterns.map((pattern) => {
        const filePattern = normalizePattern(pattern, '.spec.ts');
        return filePattern;
      });
      include.push(...testMatchPatterns);
      break;
    }

    const testMatchPatterns = patterns.map((pattern) => {
      const filePattern = normalizePattern(pattern, '.spec.ts');
      return `!**/${filePattern}`;
    });
    include.push(...testMatchPatterns);
  }

  include.reverse();

  const reportsDirectory = `./coverage/shard/${shardKey}`;
  return {
    test: {
      include,
      coverage: {
        reportsDirectory,
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() =>
  mergeConfig(
    {
      plugins: [tsconfigPaths()],
      cacheDir: ci ? '.cache/vitest' : undefined,
      test: {
        globals: true,
        setupFiles: [
          'jest-extended/all',
          'expect-more-jest',
          './test/setup.ts',
          './test/jest-legacy.ts',
          'test/to-migrate.ts',
        ],
        reporters: ci ? ['default', new GitHubActionsReporter()] : ['default'],
        mockReset: true,
        coverage: {
          provider: 'v8',
          ignoreEmptyLines: true,
          reporter: ci
            ? ['text-summary', 'lcovonly', 'json']
            : ['text-summary', 'html', 'json'],
          enabled: true,
          include: [
            'lib/**/*.{js,ts}',
            '!lib/**/*.{d,spec}.ts',
            '!lib/**/{__fixtures__,__mocks__,__testutil__,test}/**/*.{js,ts}',
            '!lib/**/types.ts',
          ],
        },
        alias: {
          'jest-mock-extended': 'vitest-mock-extended',
        },
      },
    } satisfies ViteUserConfig,
    configureShardingOrFallbackTo({
      test: {
        include: ['lib/**/*.spec.ts', 'test/**/*.spec.ts'],
      },
    }),
  ),
);

import tsconfigPaths from 'vite-tsconfig-paths';
import type { ViteUserConfig } from 'vitest/config';
import {
  coverageConfigDefaults,
  defaultExclude,
  defineConfig,
  mergeConfig,
} from 'vitest/config';
import { testShards } from './tools/test/shards.js';
import {
  getCoverageIgnorePatterns,
  normalizePattern,
} from './tools/test/utils.js';

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
  const exclude: string[] = [...defaultExclude];

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
      return `**/${filePattern}`;
    });
    exclude.push(...testMatchPatterns);
  }

  const reportsDirectory = `./coverage/shard/${shardKey}`;
  return {
    test: {
      include,
      exclude,
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
          'test/to-migrate.ts',
        ],
        reporters: ci ? ['default', 'github-actions'] : ['default'],
        mockReset: true,
        coverage: {
          provider: 'v8',
          ignoreEmptyLines: true,
          skipFull: !ci,
          reporter: ci
            ? ['text-summary', 'lcovonly', 'json']
            : ['text-summary', 'html', 'json'],
          enabled: true,
          exclude: [
            ...coverageConfigDefaults.exclude,
            ...getCoverageIgnorePatterns(),
            '**/*.spec.ts', // should work from defaults
            'lib/**/{__fixtures__,__mocks__,__testutil__,test}/**',
            'lib/**/types.ts',
            'lib/types/**',
            'tools/**',
            '+(config.js)',
            '__mocks__/**',
            // fully ignored files
            'lib/config-validator.ts',
            'lib/constants/category.ts',
            'lib/modules/datasource/hex/v2/package.ts',
            'lib/modules/datasource/hex/v2/signed.ts',
            'lib/util/cache/package/redis.ts',
            'lib/util/http/legacy.ts',
            'lib/workers/repository/cache.ts',
          ],
        },
      },
    } satisfies ViteUserConfig,
    configureShardingOrFallbackTo({
      test: {
        exclude: [...defaultExclude, 'tools/docs/test/**/*.test.mjs'],
      },
    }),
  ),
);

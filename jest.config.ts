import { readFileSync } from 'node:fs';
import os from 'node:os';
import v8 from 'node:v8';
import type { InitialOptionsTsJest } from 'ts-jest/dist/types';

const ci = !!process.env.CI;

type JestConfig = InitialOptionsTsJest & {
  // https://github.com/renovatebot/renovate/issues/17034
  workerIdleMemoryLimit?: string;
};

const cpus = os.cpus();
const mem = os.totalmem();
const stats = v8.getHeapStatistics();

process.stderr.write(`Host stats:
  Cpus:      ${cpus.length}
  Memory:    ${(mem / 1024 / 1024 / 1024).toFixed(2)} GB
  HeapLimit: ${(stats.heap_size_limit / 1024 / 1024 / 1024).toFixed(2)} GB
`);

/**
 * https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#supported-runners-and-hardware-resources
 * Currently it seems the runner only have 4GB
 */
function jestGithubRunnerSpecs(): JestConfig {
  // if (os.platform() === 'darwin') {
  //   return {
  //     maxWorkers: 2,
  //     workerIdleMemoryLimit: '4GB',
  //   };
  // }

  return {
    maxWorkers: cpus.length,
    workerIdleMemoryLimit: '1500MB', // '2GB',
  };
}

/**
 * Configuration for single test shard.
 */
interface ShardConfig {
  /**
   * Path patterns to match against the test file paths, of two types:
   *
   * 1. Particular file, e.g. `lib/util/git/index.spec.ts`
   *
   *    - File pattern MUST end with `.spec.ts`
   *    - This will only search for the particular test file
   *    - It enables coverage for the `*.ts` file with the same name,
   *      e.g. `lib/util/git/index.ts`
   *    - You probably want to use directory pattern instead
   *
   * 2. Whole directory, e.g. `lib/modules/datasource`
   *
   *    - This will search for all `*.spec.ts` files under the directory
   *    - It enables coverage all `*.ts` files under the directory,
   *      e.g. `lib/modules/datasource/foo/bar/baz.ts`
   */
  matchPaths: string[];

  /**
   * Coverage threshold settings for the entire shard (via `global` field).
   * Ommitted fields default to `100` (i.e. 100%).
   */
  threshold?: {
    branches?: number;
    functions?: number;
    lines?: number;
    statements?: number;
  };
}

/**
 * Subset of Jest config that is relevant for sharded test run.
 */
type JestShardedSubconfig = Pick<
  JestConfig,
  'testMatch' | 'collectCoverageFrom' | 'coverageThreshold'
>;

/**
 * Convert match pattern to a form that matches on file with `.ts` or `.spec.ts` extension.
 */
function normalizePattern(pattern: string, suffix: '.ts' | '.spec.ts'): string {
  return pattern.endsWith('.spec.ts')
    ? pattern.replace(/\.spec\.ts$/, suffix)
    : `${pattern}/**/*${suffix}`;
}

/**
 * Generates Jest config for sharded test run.
 *
 * If `TEST_SHARD` environment variable is not set,
 * it falls back to the provided config.
 *
 * Otherwise, `fallback` value is used to determine some defaults.
 */
function configureShardingOrFallbackTo(
  fallback: JestShardedSubconfig
): JestShardedSubconfig {
  const shardKey = process.env.TEST_SHARD;
  if (!shardKey) {
    return fallback;
  }

  /**
   * Configuration for test shards that can be run with `TEST_SHARD` environment variable.
   *
   * For each shard, we specify a subset of tests to run.
   * The tests from previous shards are excluded from the next shard.
   *
   * If the coverage threshold is not met, we adjust it
   * using the optional `threshold` field.
   *
   * Eventually, we aim to reach 100% coverage for most cases,
   * so the `threshold` field is meant to be mostly omitted in the future.
   *
   * Storing shards config in the separate file helps to form CI matrix
   * using pre-installed `jq` utility.
   */
  const testShards: Record<string, ShardConfig> = JSON.parse(
    readFileSync('.github/test-shards.json', 'utf-8')
  );

  if (!testShards[shardKey]) {
    const keys = Object.keys(testShards).join(', ');
    throw new Error(
      `Unknown value for TEST_SHARD: ${shardKey} (possible values: ${keys})`
    );
  }

  const testMatch: string[] = [];

  // Use exclusion patterns from the fallback config
  const collectCoverageFrom: string[] =
    fallback.collectCoverageFrom?.filter((pattern) =>
      pattern.startsWith('!')
    ) ?? [];

  // Use coverage threshold from the fallback config
  const defaultGlobal = fallback.coverageThreshold?.global;
  const coverageThreshold: JestConfig['coverageThreshold'] = {
    global: {
      branches: defaultGlobal?.branches ?? 100,
      functions: defaultGlobal?.functions ?? 100,
      lines: defaultGlobal?.lines ?? 100,
      statements: defaultGlobal?.statements ?? 100,
    },
  };

  for (const [key, { matchPaths: patterns, threshold }] of Object.entries(
    testShards
  )) {
    if (key === shardKey) {
      const testMatchPatterns = patterns.map((pattern) => {
        const filePattern = normalizePattern(pattern, '.spec.ts');
        return `<rootDir>/${filePattern}`;
      });
      testMatch.push(...testMatchPatterns);

      const coveragePatterns = patterns.map((pattern) =>
        normalizePattern(pattern, '.ts')
      );
      collectCoverageFrom.push(...coveragePatterns);

      if (threshold) {
        coverageThreshold.global = {
          ...coverageThreshold.global,
          ...threshold,
        };
      }

      break;
    }

    const testMatchPatterns = patterns.map((pattern) => {
      const filePattern = normalizePattern(pattern, '.spec.ts');
      return `!**/${filePattern}`;
    });
    testMatch.push(...testMatchPatterns);

    const coveragePatterns = patterns.map((pattern) => {
      const filePattern = normalizePattern(pattern, '.ts');
      return `!${filePattern}`;
    });
    collectCoverageFrom.push(...coveragePatterns);
  }

  testMatch.reverse();
  collectCoverageFrom.reverse();
  return { testMatch, collectCoverageFrom, coverageThreshold };
}

const config: JestConfig = {
  ...configureShardingOrFallbackTo({
    collectCoverageFrom: [
      'lib/**/*.{js,ts}',
      '!lib/**/*.{d,spec}.ts',
      '!lib/**/{__fixtures__,__mocks__,__testutil__,test}/**/*.{js,ts}',
      '!lib/**/types.ts',
    ],
    coverageThreshold: {
      global: {
        branches: 98,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  }),
  cacheDirectory: '.cache/jest',
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: './coverage',
  coverageReporters: ci
    ? ['html', 'json', 'text-summary']
    : ['html', 'text-summary'],
  transform: {
    '\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        diagnostics: false,
        isolatedModules: true,
      },
    ],
  },
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '/__fixtures__/',
    '/__mocks__/',
  ],
  reporters: ci ? ['default', 'github-actions'] : ['default'],
  setupFilesAfterEnv: [
    'jest-extended/all',
    'expect-more-jest',
    '<rootDir>/test/setup.ts',
    '<rootDir>/test/to-migrate.ts',
  ],
  snapshotSerializers: ['<rootDir>/test/newline-snapshot-serializer.ts'],
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  watchPathIgnorePatterns: ['<rootDir>/.cache/', '<rootDir>/coverage/'],
  // We can play with that value later for best dev experience
  workerIdleMemoryLimit: '500MB',
  // add github runner specific limits
  ...(ci && jestGithubRunnerSpecs()),
};

export default config;

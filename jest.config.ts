import os from 'node:os';
import v8 from 'node:v8';
import { testShards } from './tools/test/shards';
import type { JestConfig, JestShardedSubconfig } from './tools/test/types';
import { getCoverageIgnorePatterns } from './tools/test/utils';

const ci = !!process.env.CI;

const cpus = os.cpus();
const mem = os.totalmem();
const stats = v8.getHeapStatistics();

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
  fallback: JestShardedSubconfig,
): JestShardedSubconfig {
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

  const testMatch: string[] = [];

  for (const [key, { matchPaths: patterns }] of Object.entries(testShards)) {
    if (key === shardKey) {
      const testMatchPatterns = patterns.map((pattern) => {
        const filePattern = normalizePattern(pattern, '.spec.ts');
        return `<rootDir>/${filePattern}`;
      });
      testMatch.push(...testMatchPatterns);
      break;
    }

    const testMatchPatterns = patterns.map((pattern) => {
      const filePattern = normalizePattern(pattern, '.spec.ts');
      return `!**/${filePattern}`;
    });
    testMatch.push(...testMatchPatterns);
  }

  testMatch.reverse();

  const coverageDirectory = `./coverage/shard/${shardKey}`;
  return {
    testMatch,
    coverageDirectory,
  };
}

const config: JestConfig = {
  ...configureShardingOrFallbackTo({
    coverageDirectory: './coverage',
  }),
  collectCoverageFrom: [
    'lib/**/*.{js,ts}',
    '!lib/**/*.{d,spec}.ts',
    '!lib/**/{__fixtures__,__mocks__,__testutil__,test}/**/*.{js,ts}',
    '!lib/**/types.ts',
  ],
  coveragePathIgnorePatterns: getCoverageIgnorePatterns(),
  cacheDirectory: '.cache/jest',
  collectCoverage: true,
  coverageReporters: ci
    ? ['lcovonly', 'json']
    : ['html', 'text-summary', 'json'],
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
  resetMocks: true,
  globalSetup: '<rootDir>/test/global-setup.ts',
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

process.stderr.write(`Host stats:
    Cpus:      ${cpus.length}
    Memory:    ${(mem / 1024 / 1024 / 1024).toFixed(2)} GB
    HeapLimit: ${(stats.heap_size_limit / 1024 / 1024 / 1024).toFixed(2)} GB
  `);

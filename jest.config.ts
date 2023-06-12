import os from 'node:os';
import v8 from 'node:v8';
import { minimatch } from 'minimatch';
import type { InitialOptionsTsJest } from 'ts-jest';

const ci = !!process.env.CI;

type JestConfig = InitialOptionsTsJest & {
  // https://github.com/renovatebot/renovate/issues/17034
  workerIdleMemoryLimit?: string;
};

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
const testShards: Record<string, ShardConfig> = {
  'datasources-1': {
    matchPaths: ['lib/modules/datasource/[a-g]*'],
    threshold: {
      branches: 96.95,
    },
  },
  'datasources-2': {
    matchPaths: ['lib/modules/datasource'],
    threshold: {
      statements: 99.35,
      branches: 96.0,
      functions: 98.25,
      lines: 99.35,
    },
  },
  'managers-1': {
    matchPaths: ['lib/modules/manager/[a-c]*'],
    threshold: {
      functions: 99.3,
    },
  },
  'managers-2': {
    matchPaths: ['lib/modules/manager/[d-h]*'],
    threshold: {
      functions: 99.7,
    },
  },
  'managers-3': {
    matchPaths: ['lib/modules/manager/[i-n]*'],
    threshold: {
      statements: 99.65,
      branches: 98.5,
      functions: 98.65,
      lines: 99.65,
    },
  },
  'managers-4': {
    matchPaths: ['lib/modules/manager'],
  },
  platform: {
    matchPaths: ['lib/modules/platform'],
    threshold: {
      branches: 97.5,
    },
  },
  versioning: {
    matchPaths: ['lib/modules/versioning'],
    threshold: {
      branches: 97.25,
    },
  },
  'workers-1': {
    matchPaths: ['lib/workers/repository/{onboarding,process}'],
  },
  'workers-2': {
    matchPaths: ['lib/workers/repository/update/pr'],
    threshold: {
      branches: 97.1,
    },
  },
  'workers-3': {
    matchPaths: ['lib/workers/repository/update'],
    threshold: {
      branches: 97.75,
    },
  },
  'workers-4': {
    matchPaths: ['lib/workers'],
    threshold: {
      statements: 99.95,
      branches: 97.2,
      lines: 99.95,
    },
  },
  'git-1': {
    matchPaths: ['lib/util/git/index.spec.ts'],
    threshold: {
      statements: 99.8,
      functions: 97.55,
      lines: 99.8,
    },
  },
  'git-2': {
    matchPaths: ['lib/util/git'],
    threshold: {
      statements: 98.4,
      branches: 98.65,
      functions: 93.9,
      lines: 98.4,
    },
  },
  util: {
    matchPaths: ['lib/util'],
    threshold: {
      statements: 97.85,
      branches: 96.15,
      functions: 95.85,
      lines: 97.95,
    },
  },
  other: {
    matchPaths: ['lib'],
  },
};

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

/**
 * Given the file list affected by commit, return the list
 * of shards that  test these changes.
 */
function getMatchingShards(files: string[]): string[] {
  const matchingShards = new Set<string>();
  for (const file of files) {
    for (const [key, { matchPaths }] of Object.entries(testShards)) {
      const patterns = matchPaths.map((path) =>
        path.endsWith('.spec.ts')
          ? path.replace(/\.spec\.ts$/, '{.ts,.spec.ts}')
          : `${path}/**/*`
      );

      if (patterns.some((pattern) => minimatch(file, pattern))) {
        matchingShards.add(key);
        break;
      }
    }
  }

  const allShards = Object.keys(testShards);
  return matchingShards.size > 0
    ? allShards.filter((shard) => matchingShards.has(shard))
    : allShards;
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

/**
 * If `COMMIT_FILES` env variable is set, it means we're in `setup` CI job.
 * We don't want to see anything except key-value pairs in the output.
 * Otherwise, we're printing useful stats.
 */
if (process.env.COMMIT_FILES) {
  try {
    const commitFiles = JSON.parse(process.env.COMMIT_FILES);

    const matchingShards = getMatchingShards(commitFiles);
    // eslint-disable-next-line no-console
    console.log(`test-shards=${JSON.stringify(matchingShards)}`);

    const allShards = Object.keys(testShards);
    // eslint-disable-next-line no-console
    console.log(`test-shards-all=${JSON.stringify(allShards)}`);
  } catch (err) {
    throw new Error(
      `Invalid COMMIT_FILES value: "${process.env.COMMIT_FILES}"`
    );
  }
} else {
  process.stderr.write(`Host stats:
    Cpus:      ${cpus.length}
    Memory:    ${(mem / 1024 / 1024 / 1024).toFixed(2)} GB
    HeapLimit: ${(stats.heap_size_limit / 1024 / 1024 / 1024).toFixed(2)} GB
  `);
}

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

const shardMap: Record<string, string[]> = {
  datasource: ['lib/modules/datasource'],
  manager_1: ['lib/modules/manager/[a-m]*'],
  manager_2: ['lib/modules/manager/[n-z]*'],
  platform: ['lib/modules/platform'],
  versioning: ['lib/modules/versioning'],
  workers: ['lib/workers'],
  other: ['lib'],
};

type ShardConfig = Pick<JestConfig, 'testMatch' | 'collectCoverageFrom'>;

function tryShardOr(fallback: ShardConfig = {}): ShardConfig {
  const shardKey = process.env.TEST_SHARD;
  if (!shardKey) {
    return fallback;
  }

  if (!shardMap[shardKey]) {
    const keys = Object.keys(shardMap).join(', ');
    throw new Error(
      `Unknown value for TEST_SHARD: ${shardKey} (possible values: ${keys})`
    );
  }

  const testMatch: string[] = [];
  const collectCoverageFrom: string[] = [
    '!lib/**/types.ts',
    '!lib/**/{__fixtures__,__mocks__,__testutil__,test}/**/*.{js,ts}',
    '!lib/**/*.{d,spec}.ts',
  ];

  loop: for (const [key, patterns] of Object.entries(shardMap)) {
    for (let pattern of patterns) {
      pattern = pattern.replace(/\/+$/, '');

      const testPattern = `${pattern}/**/*.spec.ts`;
      const coveragePattern = `${pattern}/**/*.ts`;

      if (key === shardKey || key === 'other') {
        testMatch.push(`<rootDir>/${testPattern}`);
        collectCoverageFrom.push(coveragePattern);
        break loop;
      }

      testMatch.push(`!**/${testPattern}`);
      collectCoverageFrom.push(`!${coveragePattern}`);
    }
  }

  testMatch.reverse();
  collectCoverageFrom.reverse();
  const result = { testMatch, collectCoverageFrom };
  return result;
}

const config: JestConfig = {
  ...tryShardOr({
    collectCoverageFrom: [
      'lib/**/*.{js,ts}',
      '!lib/**/*.{d,spec}.ts',
      '!lib/**/{__fixtures__,__mocks__,__testutil__,test}/**/*.{js,ts}',
      '!lib/**/types.ts',
    ],
  }),
  cacheDirectory: '.cache/jest',
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: './coverage',
  coverageReporters: ci
    ? ['html', 'json', 'text-summary']
    : ['html', 'text-summary'],
  coverageThreshold: {
    global: {
      branches: 98,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
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

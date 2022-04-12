import fs from 'fs';
import JSON5 from 'json5';

const swcrc = JSON5.parse(fs.readFileSync(`./.swcrc`, 'utf-8'));

const ci = !!process.env.CI;

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  cacheDirectory: '.cache/jest',
  coverageDirectory: './coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    'lib/**/*.{js,ts}',
    '!lib/**/*.{d,spec}.ts',
    '!lib/**/{__fixtures__,__mocks__,__testutil__,test}/**/*.{js,ts}',
    '!lib/**/types.ts',
  ],
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
  modulePathIgnorePatterns: ['<rootDir>/dist/', '/__fixtures__/'],
  reporters: ci ? ['default', 'jest-github-actions-reporter'] : ['default'],
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

  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        ...swcrc,
      },
    ],
  },
};

export default config;

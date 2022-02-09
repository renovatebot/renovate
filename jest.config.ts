import type { InitialOptionsTsJest } from 'ts-jest/dist/types';

const ci = !!process.env.CI;

const config: InitialOptionsTsJest = {
  preset: 'ts-jest',
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
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      diagnostics: false,
      isolatedModules: true,
    },
  },
};

export default config;

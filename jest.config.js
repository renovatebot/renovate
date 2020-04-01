const ci = !!process.env.CI;

module.exports = {
  cacheDirectory: '.cache/jest',
  coverageDirectory: './coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    'lib/**/*.{js,ts}',
    '!lib/**/*.{d,spec}.ts',
    '!lib/**/{__fixtures__,__mocks__,__testutil__}/**/*.{js,ts}',
  ],
  coverageReporters: ci
    ? ['html', 'json', 'text-summary', 'tools/dist/jest-gh-reporter.js']
    : ['html', 'text-summary'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  reporter: ci ? ['default', 'tools/dist/jest-gh-reporter.js'] : ['default'],
  setupFilesAfterEnv: ['<rootDir>/test/globals.ts'],
  snapshotSerializers: ['<rootDir>/test/newline-snapshot-serializer.ts'],
  transform: {
    '^.+\\.(j|t)s$': 'babel-jest',
  },
};

export const presets = {
  angularJs: {
    description: 'All angular.js packages',
    packageNames: [
      'angular',
      'angular-animate',
      'angular-scroll',
      'angular-sanitize',
    ],
  },
  apollographql: {
    description: 'All packages published by Apollo GraphQL',
    sourceUrlPrefixes: ['https://github.com/apollographql/'],
  },
  mapbox: {
    description: 'All mapbox-related packages',
    packagePatterns: ['^(leaflet|mapbox)'],
  },
  eslint: {
    description: 'All eslint packages',
    packageNames: ['babel-eslint'],
    packagePatterns: ['^eslint'],
  },
  stylelint: {
    description: 'All stylelint packages',
    packagePatterns: ['^stylelint'],
  },
  tslint: {
    description: 'All tslint packages',
    packageNames: ['codelyzer'],
    packagePatterns: ['\\btslint\\b'],
  },
  linters: {
    description: 'All lint-related packages',
    extends: ['packages:eslint', 'packages:stylelint', 'packages:tslint'],
    packageNames: ['remark-lint'],
  },
  postcss: {
    description: 'All postcss packages',
    packageNames: ['postcss'],
    packagePatterns: ['^postcss-'],
  },
  jsUnitTest: {
    description: 'Unit test packages for javascript',
    packageNames: [
      'coveralls',
      'istanbul',
      'mock-fs',
      'nock',
      'nyc',
      'proxyquire',
      'supertest',
    ],
    packagePatterns: [
      '^chai',
      '^jest',
      '^mocha',
      '^qunit',
      '^sinon',
      '^should',
    ],
  },
  unitTest: {
    description: 'All unit test packages',
    extends: ['packages:jsUnitTest'],
  },
  jsTest: {
    description: 'JavaScript test packages',
    extends: ['packages:jsUnitTest'],
  },
  test: {
    description: 'Test packages',
    extends: ['packages:unitTest'],
  },
  gatsby: {
    description: 'All packages published by Gatsby',
    extends: ['monorepo:gatsby'],
  },
};

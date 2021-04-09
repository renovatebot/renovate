import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  angularJs: {
    description: 'All angular.js packages',
    matchPackageNames: [
      'angular',
      'angular-animate',
      'angular-scroll',
      'angular-sanitize',
    ],
  },
  apollographql: {
    description: 'All packages published by Apollo GraphQL',
    matchSourceUrlPrefixes: ['https://github.com/apollographql/'],
  },
  mapbox: {
    description: 'All mapbox-related packages',
    matchPackagePrefixes: ['leaflet', 'mapbox'],
  },
  emberTemplateLint: {
    description: 'All ember-template-lint packages',
    matchPackagePrefixes: ['ember-template-lint'],
  },
  eslint: {
    description: 'All eslint packages',
    matchPackageNames: ['babel-eslint'],
    matchPackagePrefixes: ['@typescript-eslint/', 'eslint'],
  },
  stylelint: {
    description: 'All stylelint packages',
    matchPackagePrefixes: ['stylelint'],
  },
  tslint: {
    description: 'All tslint packages',
    matchPackageNames: ['codelyzer'],
    matchPackagePatterns: ['\\btslint\\b'],
  },
  linters: {
    description: 'All lint-related packages',
    extends: [
      'packages:emberTemplateLint',
      'packages:eslint',
      'packages:stylelint',
      'packages:tslint',
    ],
    matchPackageNames: ['remark-lint'],
  },
  postcss: {
    description: 'All postcss packages',
    matchPackageNames: ['postcss'],
    matchPackagePrefixes: ['postcss-'],
  },
  jsUnitTest: {
    description: 'Unit test packages for javascript',
    matchPackageNames: [
      'coveralls',
      'ember-exam',
      'ember-mocha',
      'ember-qunit',
      'istanbul',
      'mock-fs',
      'nock',
      'nyc',
      'proxyquire',
      'supertest',
    ],
    matchPackagePrefixes: ['chai', 'jest', 'mocha', 'qunit', 'sinon', 'should'],
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
  googleapis: {
    matchDatasources: ['npm'],
    description: 'All googleapis packages',
    matchPackagePrefixes: ['@google-cloud/'],
  },
};

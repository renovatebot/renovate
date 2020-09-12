import { Preset } from '../common';

export const presets: Record<string, Preset> = {
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
  emberTemplateLint: {
    description: 'All ember-template-lint packages',
    packagePatterns: ['^ember-template-lint'],
  },
  eslint: {
    description: 'All eslint packages',
    packageNames: ['babel-eslint'],
    packagePatterns: ['^@typescript-eslint/', '^eslint'],
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
    extends: [
      'packages:emberTemplateLint',
      'packages:eslint',
      'packages:stylelint',
      'packages:tslint',
    ],
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

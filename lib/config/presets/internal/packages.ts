import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  angularJs: {
    description: 'All AngularJS packages',
    matchPackageNames: [
      'angular',
      'angular-animate',
      'angular-scroll',
      'angular-sanitize',
    ],
  },
  react: {
    description: 'All React packages',
    matchPackageNames: ['@types/react'],
    matchPackagePrefixes: ['react'],
  },
  apollographql: {
    description: 'All packages published by Apollo GraphQL',
    matchSourceUrlPrefixes: ['https://github.com/apollographql/'],
  },
  mapbox: {
    description: 'All Mapbox-related packages',
    matchPackagePrefixes: ['leaflet', 'mapbox'],
  },
  emberTemplateLint: {
    description: 'All ember-template-lint packages',
    matchPackagePrefixes: ['ember-template-lint'],
  },
  eslint: {
    description: 'All ESLint packages',
    matchPackageNames: ['@types/eslint', 'babel-eslint'],
    matchPackagePrefixes: ['@typescript-eslint/', 'eslint'],
  },
  stylelint: {
    description: 'All Stylelint packages',
    matchPackagePrefixes: ['stylelint'],
  },
  tslint: {
    description: 'All TSLint packages',
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
    description: 'All PostCSS packages',
    matchPackageNames: ['postcss'],
    matchPackagePrefixes: ['postcss-'],
  },
  jsUnitTest: {
    description: 'Unit test packages for JavaScript',
    matchPackageNames: [
      '@types/chai',
      '@types/ember-mocha',
      '@types/ember-qunit',
      '@types/enzyme',
      '@types/istanbul',
      '@types/jest',
      '@types/mocha',
      '@types/mock-fs',
      '@types/proxyquire',
      '@types/sinon',
      '@types/supertest',
      'coveralls',
      'ember-exam',
      'ember-mocha',
      'ember-qunit',
      'enzyme',
      'istanbul',
      'mock-fs',
      'nock',
      'nyc',
      'proxyquire',
      'supertest',
      'ts-jest',
    ],
    matchPackagePrefixes: [
      '@testing-library',
      'chai',
      'jest',
      'mocha',
      'qunit',
      'should',
      'sinon',
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
  googleapis: {
    matchDatasources: ['npm'],
    description: 'All googleapis packages',
    matchPackagePrefixes: ['@google-cloud/'],
  },
};

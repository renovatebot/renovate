import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  angularJs: {
    description: 'All AngularJS packages.',
    matchPackageNames: [
      'angular',
      'angular-animate',
      'angular-scroll',
      'angular-sanitize',
    ],
  },
  apollographql: {
    description: 'All packages published by Apollo GraphQL.',
    matchSourceUrlPrefixes: ['https://github.com/apollographql/'],
  },
  emberTemplateLint: {
    description: 'All ember-template-lint packages.',
    matchPackagePrefixes: ['ember-template-lint'],
  },
  eslint: {
    description: 'All ESLint packages.',
    matchPackageNames: ['@types/eslint', 'babel-eslint'],
    matchPackagePrefixes: ['@typescript-eslint/', 'eslint'],
  },
  gatsby: {
    description: 'All packages published by Gatsby.',
    extends: ['monorepo:gatsby'],
  },
  googleapis: {
    description: 'All `googleapis` packages.',
    matchDatasources: ['npm'],
    matchPackageNames: ['google-auth-library'],
    matchPackagePrefixes: ['@google-cloud/'],
  },
  jsTest: {
    description: 'JavaScript test packages.',
    extends: ['packages:jsUnitTest'],
  },
  jsUnitTest: {
    description: 'Unit test packages for JavaScript.',
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
      'ts-auto-mock',
      'ts-jest',
      'vitest',
    ],
    matchPackagePrefixes: [
      '@testing-library',
      '@vitest',
      'chai',
      'jest',
      'mocha',
      'qunit',
      'should',
      'sinon',
    ],
  },
  linters: {
    description: 'All lint-related packages.',
    extends: [
      'packages:emberTemplateLint',
      'packages:eslint',
      'packages:stylelint',
      'packages:tslint',
    ],
    matchPackageNames: ['prettier', 'remark-lint', 'standard'],
  },
  mapbox: {
    description: 'All Mapbox-related packages.',
    matchPackagePrefixes: ['leaflet', 'mapbox'],
  },
  postcss: {
    description: 'All PostCSS packages.',
    matchPackageNames: ['postcss'],
    matchPackagePrefixes: ['postcss-'],
  },
  react: {
    description: 'All React packages.',
    matchPackageNames: ['@types/react'],
    matchPackagePrefixes: ['react'],
  },
  stylelint: {
    description: 'All Stylelint packages.',
    matchPackagePrefixes: ['stylelint'],
  },
  test: {
    description: 'Test packages.',
    extends: ['packages:unitTest'],
  },
  tslint: {
    description: 'All TSLint packages.',
    matchPackageNames: ['codelyzer'],
    matchPackagePatterns: ['\\btslint\\b'],
  },
  unitTest: {
    description: 'All unit test packages.',
    extends: ['packages:jsUnitTest'],
  },
};

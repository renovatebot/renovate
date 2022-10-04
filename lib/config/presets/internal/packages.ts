import { _ } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  angularJs: {
    description: _('All AngularJS packages.'),
    matchPackageNames: [
      'angular',
      'angular-animate',
      'angular-scroll',
      'angular-sanitize',
    ],
  },
  react: {
    description: _('All React packages.'),
    matchPackageNames: ['@types/react'],
    matchPackagePrefixes: ['react'],
  },
  apollographql: {
    description: _('All packages published by Apollo GraphQL.'),
    matchSourceUrlPrefixes: ['https://github.com/apollographql/'],
  },
  mapbox: {
    description: _('All Mapbox-related packages.'),
    matchPackagePrefixes: ['leaflet', 'mapbox'],
  },
  emberTemplateLint: {
    description: _('All ember-template-lint packages.'),
    matchPackagePrefixes: ['ember-template-lint'],
  },
  eslint: {
    description: _('All ESLint packages.'),
    matchPackageNames: ['@types/eslint', 'babel-eslint'],
    matchPackagePrefixes: ['@typescript-eslint/', 'eslint'],
  },
  stylelint: {
    description: _('All Stylelint packages.'),
    matchPackagePrefixes: ['stylelint'],
  },
  tslint: {
    description: _('All TSLint packages.'),
    matchPackageNames: ['codelyzer'],
    matchPackagePatterns: ['\\btslint\\b'],
  },
  linters: {
    description: _('All lint-related packages.'),
    extends: [
      'packages:emberTemplateLint',
      'packages:eslint',
      'packages:stylelint',
      'packages:tslint',
    ],
    matchPackageNames: ['remark-lint'],
  },
  postcss: {
    description: _('All PostCSS packages.'),
    matchPackageNames: ['postcss'],
    matchPackagePrefixes: ['postcss-'],
  },
  jsUnitTest: {
    description: _('Unit test packages for JavaScript.'),
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
    description: _('All unit test packages.'),
    extends: ['packages:jsUnitTest'],
  },
  jsTest: {
    description: _('JavaScript test packages.'),
    extends: ['packages:jsUnitTest'],
  },
  test: {
    description: _('Test packages.'),
    extends: ['packages:unitTest'],
  },
  gatsby: {
    description: _('All packages published by Gatsby.'),
    extends: ['monorepo:gatsby'],
  },
  googleapis: {
    matchDatasources: ['npm'],
    description: _('All `googleapis` packages.'),
    matchPackagePrefixes: ['@google-cloud/'],
  },
};

import { gt } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  angularJs: {
    description: gt.gettext('All AngularJS packages.'),
    matchPackageNames: [
      'angular',
      'angular-animate',
      'angular-scroll',
      'angular-sanitize',
    ],
  },
  react: {
    description: gt.gettext('All React packages.'),
    matchPackageNames: ['@types/react'],
    matchPackagePrefixes: ['react'],
  },
  apollographql: {
    description: gt.gettext('All packages published by Apollo GraphQL.'),
    matchSourceUrlPrefixes: ['https://github.com/apollographql/'],
  },
  mapbox: {
    description: gt.gettext('All Mapbox-related packages.'),
    matchPackagePrefixes: ['leaflet', 'mapbox'],
  },
  emberTemplateLint: {
    description: gt.gettext('All ember-template-lint packages.'),
    matchPackagePrefixes: ['ember-template-lint'],
  },
  eslint: {
    description: gt.gettext('All ESLint packages.'),
    matchPackageNames: ['@types/eslint', 'babel-eslint'],
    matchPackagePrefixes: ['@typescript-eslint/', 'eslint'],
  },
  stylelint: {
    description: gt.gettext('All Stylelint packages.'),
    matchPackagePrefixes: ['stylelint'],
  },
  tslint: {
    description: gt.gettext('All TSLint packages.'),
    matchPackageNames: ['codelyzer'],
    matchPackagePatterns: ['\\btslint\\b'],
  },
  linters: {
    description: gt.gettext('All lint-related packages.'),
    extends: [
      'packages:emberTemplateLint',
      'packages:eslint',
      'packages:stylelint',
      'packages:tslint',
    ],
    matchPackageNames: ['remark-lint'],
  },
  postcss: {
    description: gt.gettext('All PostCSS packages.'),
    matchPackageNames: ['postcss'],
    matchPackagePrefixes: ['postcss-'],
  },
  jsUnitTest: {
    description: gt.gettext('Unit test packages for JavaScript.'),
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
    description: gt.gettext('All unit test packages.'),
    extends: ['packages:jsUnitTest'],
  },
  jsTest: {
    description: gt.gettext('JavaScript test packages.'),
    extends: ['packages:jsUnitTest'],
  },
  test: {
    description: gt.gettext('Test packages.'),
    extends: ['packages:unitTest'],
  },
  gatsby: {
    description: gt.gettext('All packages published by Gatsby.'),
    extends: ['monorepo:gatsby'],
  },
  googleapis: {
    matchDatasources: ['npm'],
    description: gt.gettext('All `googleapis` packages.'),
    matchPackagePrefixes: ['@google-cloud/'],
  },
};

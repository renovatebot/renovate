import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {"caseSensitive": false, "natural": true}] */
export const presets: Record<string, Preset> = {
  all: {
    description: 'All replacements',
    extends: [
      'replacements:babel-eslint-to-eslint-parser',
      'replacements:cucumber-to-scoped',
      'replacements:emotion-10-to-11',
      'replacements:hapi-to-scoped',
      'replacements:jade-to-pug',
      'replacements:joi-to-scoped',
      'replacements:joi-to-unscoped',
      'replacements:renovate-pep440-to-renovatebot-pep440',
      'replacements:rollup-node-resolve-to-scoped',
    ],
  },
  'babel-eslint-to-eslint-parser': {
    description: 'babel-eslint was renamed under the @babel scope',
    packageRules: [
      {
        matchCurrentVersion: '>=7.11.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['babel-eslint'],
        replacementName: '@babel/eslint-parser',
        replacementVersion: '7.11.0',
      },
    ],
  },
  'cucumber-to-scoped': {
    description: 'cucumber became scoped',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['cucumber'],
        replacementName: '@cucumber/cucumber',
        replacementVersion: '7.0.0',
      },
    ],
  },
  'emotion-10-to-11': {
    description:
      'various unscoped emotion v10 packages became renamed & scoped in v11',
    packageRules: [
      {
        matchCurrentVersion: '>=11.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@emotion/core', 'emotion-theming'],
        replacementName: '@emotion/react',
        replacementVersion: '11.0.0',
      },
      {
        matchCurrentVersion: '>=11.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['emotion', 'create-emotion'],
        replacementName: '@emotion/css',
        replacementVersion: '11.0.0',
      },
      {
        matchCurrentVersion: '>=11.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['emotion-server', 'create-emotion-server'],
        replacementName: '@emotion/server',
        replacementVersion: '11.0.0',
      },
      {
        matchCurrentVersion: '>=11.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['babel-plugin-emotion'],
        replacementName: '@emotion/babel-plugin',
        replacementVersion: '11.0.0',
      },
      {
        matchCurrentVersion: '>=11.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['eslint-plugin-emotion'],
        replacementName: '@emotion/eslint-plugin',
        replacementVersion: '11.0.0',
      },
      {
        matchCurrentVersion: '>=11.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['jest-emotion'],
        replacementName: '@emotion/jest',
        replacementVersion: '11.0.0',
      },
    ],
  },
  'hapi-to-scoped': {
    description: 'hapi became scoped',
    packageRules: [
      {
        matchCurrentVersion: '>=18.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['hapi'],
        replacementName: '@hapi/hapi',
        replacementVersion: '18.2.0',
      },
    ],
  },
  'jade-to-pug': {
    description: 'Jade was renamed to Pug',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['jade'],
        replacementName: 'pug',
        replacementVersion: '2.0.0',
      },
    ],
  },
  'joi-to-scoped': {
    description: 'joi became scoped under the hapi organization',
    packageRules: [
      {
        matchCurrentVersion: '>=14.0.0 <14.4.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['joi'],
        replacementName: '@hapi/joi',
        replacementVersion: '14.4.0',
      },
    ],
  },
  'joi-to-unscoped': {
    description: 'joi was moved out of the hapi organization',
    packageRules: [
      {
        matchCurrentVersion: '>=17.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@hapi/joi'],
        replacementName: 'joi',
        replacementVersion: '17.1.1',
      },
    ],
  },
  'redux-devtools-extension-to-scope': {
    description:
      'the redux-devtools-extension package was renamed to @redux-devtools/extension',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['redux-devtools-extension'],
        replacementName: '@redux-devtools/extension',
        replacementVersion: '3.0.0',
      },
    ],
  },
  'renovate-pep440-to-renovatebot-pep440': {
    description:
      'the @renovate/pep440 package was renamed to @renovatebot/pep440',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['@renovate/pep440'],
        replacementName: '@renovatebot/pep440',
        replacementVersion: '1.0.0',
      },
    ],
  },
  'rollup-node-resolve-to-scoped': {
    description: 'the node-resolve plugin for rollup became scoped',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['rollup-plugin-node-resolve'],
        replacementName: '@rollup/plugin-node-resolve',
        replacementVersion: '6.0.0',
      },
    ],
  },
};

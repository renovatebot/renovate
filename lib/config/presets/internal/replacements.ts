import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {"caseSensitive": false, "natural": true}] */
export const presets: Record<string, Preset> = {
  all: {
    description: 'All replacements',
    extends: [
      'replacements:cucumber-to-scoped',
      'replacements:hapi-to-scoped',
      'replacements:jade-to-pug',
      'replacements:joi-to-scoped',
      'replacements:joi-to-unscoped',
      'replacements:rollup-node-resolve-to-scoped',
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
  'hapi-to-scoped': {
    description: 'hapi became scoped',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['hapi'],
        matchCurrentVersion: '>=18.0.0',
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
        matchDatasources: ['npm'],
        matchPackageNames: ['joi'],
        matchCurrentVersion: '>=14.0.0',
        replacementName: '@hapi/joi',
        replacementVersion: '14.4.0',
      },
    ],
  },
  'joi-to-unscoped': {
    description: 'joi was moved out of the hapi organization',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['@hapi/joi'],
        matchCurrentVersion: '>=17.0.0',
        replacementName: 'joi',
        replacementVersion: '17.1.1',
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

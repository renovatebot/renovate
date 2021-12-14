import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {"caseSensitive": false, "natural": true}] */
export const presets: Record<string, Preset> = {
  all: {
    description: 'All replacements',
    extends: [
      'replacements:cucumber-to-scoped',
      'replacements:jade-to-pug',
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

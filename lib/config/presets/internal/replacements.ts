import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  all: {
    description: 'All replacements',
    extends: [
      'replacements:jade-to-pug',
      'replacements:cucumber-to-scoped',
      'replacements:rollup-node-resolve-to-scoped',
      'replacements:flake8-pathlib-to-flake8-use-pathlib',
    ],
  },
  'flake8-pathlib-to-flake8-use-pathlib': {
    description: 'flake8-pathlib was renamed to flake8-use-pathlib',
    packageRules: [
      {
        matchDatasources: ['pypi'],
        matchPackageNames: ['flake8-pathlib'],
        replacementName: 'flake8-use-pathlib',
        replacementVersion: '0.2.1',
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

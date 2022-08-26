import type { Preset } from '../types';
import {
  PresetTemplate,
  Replacement,
  addPresets,
} from './auto-generate-replacements';

/* eslint sort-keys: ["error", "asc", {"caseSensitive": false, "natural": true}] */
export const presets: Record<string, Preset> = {
  all: {
    description: 'All replacements.',
    extends: [
      'replacements:babel-eslint-to-eslint-parser',
      'replacements:cucumber-to-scoped',
      'replacements:hapi-to-scoped',
      'replacements:jade-to-pug',
      'replacements:joi-to-scoped',
      'replacements:joi-to-unscoped',
      'replacements:now-to-vercel',
      'replacements:react-query-devtools-to-scoped',
      'replacements:react-query-to-scoped',
      'replacements:renovate-pep440-to-renovatebot-pep440',
      'replacements:rollup-node-resolve-to-scoped',
      'replacements:xmldom-to-scoped',
    ],
  },
  'babel-eslint-to-eslint-parser': {
    description: '`babel-eslint` was renamed under the `@babel` scope.',
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
    description: '`cucumber` became scoped.',
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
    description: '`hapi` became scoped.',
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
    description: 'Jade was renamed to Pug.',
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
    description: '`joi` became scoped under the `hapi` organization.',
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
    description: '`joi` was moved out of the `hapi` organization.',
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
  'now-to-vercel': {
    description: '`now` was renamed to `vercel`.',
    packageRules: [
      {
        matchCurrentVersion: '>=21.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['now'],
        replacementName: 'vercel',
        replacementVersion: '21.0.0',
      },
    ],
  },
  'react-query-devtools-to-scoped': {
    description:
      '`react-query/devtools` became scoped under the `tanstack` organization.',
    packageRules: [
      {
        matchCurrentVersion: '>=2.0.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['react-query/devtools'],
        replacementName: '@tanstack/react-query-devtools',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'react-query-to-scoped': {
    description:
      '`react-query` became scoped under the `tanstack` organization.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.0.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['react-query'],
        replacementName: '@tanstack/react-query',
        replacementVersion: '4.0.5',
      },
    ],
  },
  'redux-devtools-extension-to-scope': {
    description:
      'The `redux-devtools-extension` package was renamed to `@redux-devtools/extension`.',
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
      'The `@renovate/pep440` package was renamed to `@renovatebot/pep440`.',
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
    description: 'The node-resolve plugin for rollup became scoped.',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['rollup-plugin-node-resolve'],
        replacementName: '@rollup/plugin-node-resolve',
        replacementVersion: '6.0.0',
      },
    ],
  },
  'xmldom-to-scoped': {
    description: 'The `xmldom` package is now published as `@xmldom/xmldom`.',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['xmldom', 'xmldom-alpha'],
        replacementName: '@xmldom/xmldom',
        replacementVersion: '0.7.5',
      },
    ],
  },
};

const muiReplacement: Replacement[] = [
  [['@material-ui/codemod'], '@mui/codemod'],
  [['@material-ui/core'], '@mui/material'],
  [['@material-ui/icons'], '@mui/icons-material'],
  [['@material-ui/lab'], '@mui/labs'],
  [['@material-ui/private-theming'], '@mui/private-theming'],
  [['@material-ui/styled-engine'], '@mui/styled-engine'],
  [['@material-ui/styled-engine-sc'], '@mui/styled-engine-sc'],
  [['@material-ui/styles'], '@mui/styles'],
  [['@material-ui/system'], '@mui/system'],
  [['@material-ui/types'], '@mui/types'],
  [['@material-ui/unstyled'], '@mui/core'],
];

const mui: PresetTemplate = {
  description:
    'The `material-ui` monorepo org was renamed from `@material-ui` to `@mui`.',
  packageRules: {
    matchCurrentVersion: '>=4.0.0 <5.0.0',
    matchDatasources: ['npm'],
    replacements: muiReplacement,
    replacementVersion: '5.0.0',
  },
  title: 'material-ui-to-mui',
};

addPresets(presets, mui);

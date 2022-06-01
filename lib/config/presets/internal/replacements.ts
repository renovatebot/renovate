import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {"caseSensitive": false, "natural": true}] */
export const presets: Record<string, Preset> = {
  all: {
    description: 'All replacements',
    extends: [
      'replacements:babel-eslint-to-eslint-parser',
      'replacements:cucumber-to-scoped',
      'replacements:hapi-to-scoped',
      'replacements:jade-to-pug',
      'replacements:joi-to-scoped',
      'replacements:joi-to-unscoped',
      'replacements:material-ui/codemod-to-mui/codemod',
      'replacements:material-ui/core-to-mui/material',
      'replacements:material-ui/icons-to-mui/icons-material',
      'replacements:material-ui/lab-to-mui/lab',
      'replacements:material-ui/private-theming-to-mui/private-theming',
      'replacements:material-ui/styled-engine-sc-to-mui/styled-engine-sc',
      'replacements:material-ui/styled-engine-to-mui/styled-engine',
      'replacements:material-ui/styles-to-mui/styles',
      'replacements:material-ui/system-to-mui/system',
      'replacements:material-ui/types-ui-to-mui/types',
      'replacements:material-ui/unstyled-to-mui/core',
      'replacements:renovate-pep440-to-renovatebot-pep440',
      'replacements:rollup-node-resolve-to-scoped',
      'replacements:xmldom-to-scoped',
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
  'material-ui/codemod-to-mui/codemod': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/codemod'],
        replacementName: '@mui/codemod',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/core-to-mui/material': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/core'],
        replacementName: '@mui/material',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/icons-to-mui/icons-material': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/icons'],
        replacementName: '@mui/icons-material',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/lab-to-mui/lab': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/lab'],
        replacementName: '@mui/lab ',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/private-theming-to-mui/private-theming': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/private-theming'],
        replacementName: '@mui/private-theming',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/styled-engine-sc-to-mui/styled-engine-sc': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/styled-engine-sc'],
        replacementName: '@mui/styled-engine-sc',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/styled-engine-to-mui/styled-engine': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/styled-engine'],
        replacementName: '@mui/styled-engine',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/styles-to-mui/styles': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/styles'],
        replacementName: '@mui/styles',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/system-to-mui/system': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/system'],
        replacementName: '@mui/system',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/types-ui-to-mui/types': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/types'],
        replacementName: '@mui/types',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'material-ui/unstyled-to-mui/core': {
    description: 'the @material-ui/ monorepo org was renamed to @mui/',
    packageRules: [
      {
        matchCurrentVersion: '>=4.0.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['@material-ui/unstyled'],
        replacementName: '@mui/core',
        replacementVersion: '5.0.0',
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
  'xmldom-to-scoped': {
    description: 'the xmldom package is now published as @xmldom/xmldom',
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

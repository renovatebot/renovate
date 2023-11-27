import type { Preset } from '../types';
import {
  PresetTemplate,
  Replacement,
  addPresets,
} from './auto-generate-replacements';

/* eslint sort-keys: ["error", "asc", {"caseSensitive": false, "natural": true}] */
export const presets: Record<string, Preset> = {
  all: {
    description: 'Apply crowd-sourced package replacement rules.',
    extends: [
      'replacements:apollo-server-to-scoped',
      'replacements:babel-eslint-to-eslint-parser',
      'replacements:containerbase',
      'replacements:cucumber-to-scoped',
      'replacements:fastify-to-scoped',
      'replacements:hapi-to-scoped',
      'replacements:jade-to-pug',
      'replacements:joi-to-scoped',
      'replacements:joi-to-unscoped',
      'replacements:k8s-registry-move',
      'replacements:middie-to-scoped',
      'replacements:now-to-vercel',
      'replacements:parcel-css-to-lightningcss',
      'replacements:react-query-devtools-to-scoped',
      'replacements:react-query-to-scoped',
      'replacements:react-scripts-ts-to-react-scripts',
      'replacements:renovate-pep440-to-renovatebot-pep440',
      'replacements:rollup-babel-to-scoped',
      'replacements:rollup-node-resolve-to-scoped',
      'replacements:rome-to-biome',
      'replacements:vso-task-lib-to-azure-pipelines-task-lib',
      'replacements:vsts-task-lib-to-azure-pipelines-task-lib',
      'replacements:xmldom-to-scoped',
    ],
    ignoreDeps: [], // Hack to improve onboarding PR description
  },
  'apollo-server-to-scoped': {
    description: '`apollo-server` packages became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.10.3',
        matchDatasources: ['npm'],
        matchPackageNames: [
          'apollo-server',
          'apollo-server-core',
          'apollo-server-express',
        ],
        replacementName: '@apollo/server',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=3.3.1',
        matchDatasources: ['npm'],
        matchPackageNames: ['apollo-server-errors'],
        replacementName: '@apollo/server',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=3.6.3',
        matchDatasources: ['npm'],
        matchPackageNames: ['apollo-server-types', 'apollo-server-plugin-base'],
        replacementName: '@apollo/server',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=3.7.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['apollo-datasource-rest'],
        replacementName: '@apollo/datasource-rest',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=3.7.1',
        matchDatasources: ['npm'],
        matchPackageNames: ['apollo-server-plugin-response-cache'],
        replacementName: '@apollo/server-plugin-response-cache',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=3.5.1',
        matchDatasources: ['npm'],
        matchPackageNames: ['apollo-server-plugin-operation-registry'],
        replacementName: '@apollo/server-plugin-operation-registry',
        replacementVersion: '3.5.6',
      },
      {
        matchCurrentVersion: '>=3.3.3',
        matchDatasources: ['npm'],
        matchPackageNames: ['apollo-reporting-protobuf'],
        replacementName: '@apollo/usage-reporting-protobuf',
        replacementVersion: '4.0.0',
      },
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
  containerbase: {
    description: 'Replace containerbase dependencies.',
    packageRules: [
      {
        description:
          'Replace `containerbase/(buildpack|base)` and `renovate/buildpack` with `ghcr.io/containerbase/base`.',
        matchDatasources: ['docker'],
        matchPackagePatterns: [
          '^(?:docker\\.io/)?containerbase/(?:buildpack|base)$',
          '^ghcr\\.io/containerbase/buildpack$',
          '^(?:docker\\.io/)?renovate/buildpack$',
        ],
        replacementName: 'ghcr.io/containerbase/base',
      },
      {
        description:
          'Replace `containerbase/node` and `renovate/node` with `ghcr.io/containerbase/node`.',
        matchDatasources: ['docker'],
        matchPackagePatterns: [
          '^(?:docker\\.io/)?(?:containerbase|renovate)/node$',
        ],
        replacementName: 'ghcr.io/containerbase/node',
      },
      {
        description:
          'Replace `containerbase/sidecar` and `renovate/sidecar` with `ghcr.io/containerbase/sidecar`.',
        matchDatasources: ['docker'],
        matchPackagePatterns: [
          '^(?:docker\\.io/)?(?:containerbase|renovate)/sidecar$',
        ],
        replacementName: 'ghcr.io/containerbase/sidecar',
      },
      {
        description:
          'Replace `renovatebot/internal-tools` with `containerbase/internal-tools`.',
        matchDatasources: ['github-tags'],
        matchPackageNames: ['renovatebot/internal-tools'],
        replacementName: 'containerbase/internal-tools',
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
  'fastify-to-scoped': {
    description: '`fastify` packages became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.3.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-accepts-serializer'],
        replacementName: '@fastify/accepts-serializer',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=2.3.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-accepts'],
        replacementName: '@fastify/accepts',
        replacementVersion: '3.0.0',
      },
      {
        matchCurrentVersion: '>=1.2.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-auth'],
        replacementName: '@fastify/auth',
        replacementVersion: '2.0.0',
      },
      {
        matchCurrentVersion: '>=3.13.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-autoload'],
        replacementName: '@fastify/autoload',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=1.3.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-awilix'],
        replacementName: '@fastify/awilix',
        replacementVersion: '2.0.0',
      },
      {
        matchCurrentVersion: '>=2.3.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-basic-auth'],
        replacementName: '@fastify/basic-auth',
        replacementVersion: '3.0.0',
      },
      {
        matchCurrentVersion: '>=6.3.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-bearer-auth'],
        replacementName: '@fastify/bearer-auth',
        replacementVersion: '7.0.0',
      },
      {
        matchCurrentVersion: '>=6.3.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-caching'],
        replacementName: '@fastify/caching',
        replacementVersion: '7.0.0',
      },
      {
        matchCurrentVersion: '>=1.2.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-circuit-breaker'],
        replacementName: '@fastify/circuit-breaker',
        replacementVersion: '2.0.0',
      },
      {
        matchCurrentVersion: '>=4.1.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-compress'],
        replacementName: '@fastify/compress',
        replacementVersion: '5.0.0',
      },
      {
        matchCurrentVersion: '>=5.7.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-cookie'],
        replacementName: '@fastify/cookie',
        replacementVersion: '6.0.0',
      },
      {
        matchCurrentVersion: '>=6.1.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-cors'],
        replacementName: '@fastify/cors',
        replacementVersion: '7.0.0',
      },
      {
        matchCurrentVersion: '>=1.1.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-diagnostics-channel'],
        replacementName: '@fastify/diagnostics-channel',
        replacementVersion: '2.0.0',
      },
      {
        matchCurrentVersion: '>=1.2.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-elasticsearch'],
        replacementName: '@fastify/elasticsearch',
        replacementVersion: '2.0.0',
      },
      {
        matchCurrentVersion: '>=2.2.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-env'],
        replacementName: '@fastify/env',
        replacementVersion: '3.0.0',
      },
      {
        matchCurrentVersion: '>=1.2.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-error'],
        replacementName: '@fastify/error',
        replacementVersion: '2.0.0',
      },
      {
        matchCurrentVersion: '>=2.2.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-etag'],
        replacementName: '@fastify/etag',
        replacementVersion: '3.0.0',
      },
      {
        matchCurrentVersion: '>=0.4.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-express'],
        replacementName: '@fastify/express',
        replacementVersion: '1.0.0',
      },
      {
        matchCurrentVersion: '>=3.1.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-flash'],
        replacementName: '@fastify/flash',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=5.3.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-formbody'],
        replacementName: '@fastify/formbody',
        replacementVersion: '6.0.0',
      },
      {
        matchCurrentVersion: '>=1.1.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-funky'],
        replacementName: '@fastify/funky',
        replacementVersion: '2.0.0',
      },
      {
        matchCurrentVersion: '>=7.1.0 <8.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-helmet'],
        replacementName: '@fastify/helmet',
        replacementVersion: '8.0.0',
      },
      {
        matchCurrentVersion: '>=0.3.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-hotwire'],
        replacementName: '@fastify/hotwire',
        replacementVersion: '1.0.0',
      },
      {
        matchCurrentVersion: '>=6.3.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-http-proxy'],
        replacementName: '@fastify/http-proxy',
        replacementVersion: '7.0.0',
      },
      {
        matchCurrentVersion: '>=4.2.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-jwt'],
        replacementName: '@fastify/jwt',
        replacementVersion: '5.0.0',
      },
      {
        matchCurrentVersion: '>=0.3.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-kafka'],
        replacementName: '@fastify/kafka',
        replacementVersion: '1.0.0',
      },
      {
        matchCurrentVersion: '>=3.2.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-leveldb'],
        replacementName: '@fastify/leveldb',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=4.2.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-mongodb'],
        replacementName: '@fastify/mongodb',
        replacementVersion: '5.0.0',
      },
      {
        matchCurrentVersion: '>=5.4.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-multipart'],
        replacementName: '@fastify/multipart',
        replacementVersion: '6.0.0',
      },
      {
        matchCurrentVersion: '>=2.2.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-mysql'],
        replacementName: '@fastify/mysql',
        replacementVersion: '3.0.0',
      },
      {
        matchCurrentVersion: '>=7.3.0 <8.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-nextjs'],
        replacementName: '@fastify/nextjs',
        replacementVersion: '8.0.0',
      },
      {
        matchCurrentVersion: '>=4.6.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-oauth2'],
        replacementName: '@fastify/oauth2',
        replacementVersion: '5.0.0',
      },
      {
        matchCurrentVersion: '>=0.5.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-passport'],
        replacementName: '@fastify/passport',
        replacementVersion: '1.0.0',
      },
      {
        matchCurrentVersion: '>=3.7.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-postgres'],
        replacementName: '@fastify/postgres',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=5.9.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-rate-limit'],
        replacementName: '@fastify/rate-limit',
        replacementVersion: '6.0.0',
      },
      {
        matchCurrentVersion: '>=4.4.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-redis'],
        replacementName: '@fastify/redis',
        replacementVersion: '5.0.0',
      },
      {
        matchCurrentVersion: '>=6.7.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-reply-from'],
        replacementName: '@fastify/reply-from',
        replacementVersion: '7.0.0',
      },
      {
        matchCurrentVersion: '>=2.3.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-request-context'],
        replacementName: '@fastify/request-context',
        replacementVersion: '3.0.0',
      },
      {
        matchCurrentVersion: '>=0.3.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-response-validation'],
        replacementName: '@fastify/response-validation',
        replacementVersion: '1.0.0',
      },
      {
        matchCurrentVersion: '>=2.1.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-routes-stats'],
        replacementName: '@fastify/routes-stats',
        replacementVersion: '3.0.0',
      },
      {
        matchCurrentVersion: '>=3.2.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-routes'],
        replacementName: '@fastify/routes',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=1.1.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-schedule'],
        replacementName: '@fastify/schedule',
        replacementVersion: '2.0.0',
      },
      {
        matchCurrentVersion: '>=3.2.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-secure-session'],
        replacementName: '@fastify/secure-session',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=3.2.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-sensible'],
        replacementName: '@fastify/sensible',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=0.3.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-soap-client'],
        replacementName: '@fastify/soap-client',
        replacementVersion: '1.0.0',
      },
      {
        matchCurrentVersion: '>=4.7.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-static'],
        replacementName: '@fastify/static',
        replacementVersion: '5.0.0',
      },
      {
        matchCurrentVersion: '>=5.2.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-swagger'],
        replacementName: '@fastify/swagger',
        replacementVersion: '6.0.0',
      },
      {
        matchCurrentVersion: '>=3.1.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-url-data'],
        replacementName: '@fastify/url-data',
        replacementVersion: '4.0.0',
      },
      {
        matchCurrentVersion: '>=4.3.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-websocket'],
        replacementName: '@fastify/websocket',
        replacementVersion: '5.0.0',
      },
      {
        matchCurrentVersion: '>=2.1.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-zipkin'],
        replacementName: '@fastify/zipkin',
        replacementVersion: '3.0.0',
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
  'k8s-registry-move': {
    description:
      'The Kubernetes container registry has changed from `k8s.gcr.io` to `registry.k8s.io`.',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchPackagePatterns: ['^k8s\\.gcr\\.io/.+$'],
        replacementNameTemplate:
          "{{{replace 'k8s\\.gcr\\.io/' 'registry.k8s.io/' packageName}}}",
      },
    ],
  },
  'middie-to-scoped': {
    description: '`middie` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=7.1.0 <8.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['middie'],
        replacementName: '@fastify/middie',
        replacementVersion: '8.0.0',
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
  'npm-run-all-to-maintenance-fork': {
    description: 'Maintenance fork of `npm-run-all`',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['npm-run-all'],
        replacementName: 'npm-run-all2',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'parcel-css-to-lightningcss': {
    description: '`@parcel/css` was renamed to `lightningcss`.',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['@parcel/css'],
        replacementName: 'lightningcss',
        replacementVersion: '1.14.0',
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
  'react-scripts-ts-to-react-scripts': {
    description: '`react-scripts` supports TypeScript since version `2.1.0`.',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['react-scripts-ts'],
        replacementName: 'react-scripts',
        replacementVersion: '2.1.8',
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
  'rollup-babel-to-scoped': {
    description: 'The babel plugin for rollup became scoped.',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['rollup-plugin-babel'],
        replacementName: '@rollup/plugin-babel',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'rollup-json-to-scoped': {
    description: 'The json plugin for rollup became scoped.',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['rollup-plugin-json'],
        replacementName: '@rollup/plugin-json',
        replacementVersion: '4.0.0',
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
  'rome-to-biome': {
    description:
      'The Rome repository is archived, and Biome is the community replacement. Read [the Biome announcement](https://biomejs.dev/blog/annoucing-biome/) for migration instructions.',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['rome'],
        replacementName: '@biomejs/biome',
        replacementVersion: '1.0.0',
      },
    ],
  },
  'spectre-cli-to-spectre-console-cli': {
    description:
      'The `Spectre.Cli` package was renamed to `Spectre.Console.Cli`.',
    packageRules: [
      {
        matchDatasources: ['nuget'],
        matchPackageNames: ['Spectre.Cli'],
        replacementName: 'Spectre.Console.Cli',
        replacementVersion: '0.45.0',
      },
    ],
  },
  'vso-task-lib-to-azure-pipelines-task-lib': {
    description:
      'The `vso-task-lib` package is now published as `azure-pipelines-task-lib`.',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['vso-task-lib'],
        replacementName: 'azure-pipelines-task-lib',
        replacementVersion: '3.4.0',
      },
    ],
  },
  'vsts-task-lib-to-azure-pipelines-task-lib': {
    description:
      'The `vsts-task-lib` package is now published as `azure-pipelines-task-lib`.',
    packageRules: [
      {
        matchDatasources: ['npm'],
        matchPackageNames: ['vsts-task-lib'],
        replacementName: 'azure-pipelines-task-lib',
        replacementVersion: '3.4.0',
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
  packageRules: [
    {
      matchCurrentVersion: '>=4.0.0 <5.0.0',
      matchDatasources: ['npm'],
      replacements: muiReplacement,
      replacementVersion: '5.0.0',
    },
  ],
  title: 'material-ui-to-mui',
};

const messageFormat: PresetTemplate = {
  description:
    'The `messageformat` monorepo package naming scheme changed from `messageFormat-{{package}}`-to-`@messageformat/{{package}}`.',
  packageRules: [
    {
      matchCurrentVersion: '>=2.0.0 <3.0.0',
      matchDatasources: ['npm'],
      replacements: [
        [['messageformat-cli'], '@messageformat/cli'],
        [['messageformat'], '@messageformat/core'],
      ],
      replacementVersion: '3.0.0',
    },
    {
      matchCurrentVersion: '>=0.4.0 <1.0.0',
      matchDatasources: ['npm'],
      replacements: [
        [['messageformat-convert'], '@messageformat/convert'],
        [['react-message-context'], '@messageformat/react'],
      ],
      replacementVersion: '1.0.0',
    },
    {
      matchCurrentVersion: '>=4.0.0 <5.0.0',
      matchDatasources: ['npm'],
      replacements: [[['messageformat-parser'], '@messageformat/parser']],
      replacementVersion: '5.0.0',
    },
  ],
  title: 'messageFormat-{{package}}-to-@messageformat/{{package}}',
};

addPresets(presets, messageFormat, mui);

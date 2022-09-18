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
      'replacements:fastify-accepts-serializer-to-scoped',
      'replacements:fastify-accepts-to-scoped',
      'replacements:fastify-auth-to-scoped',
      'replacements:fastify-autoload-to-scoped',
      'replacements:fastify-awilix-to-scoped',
      'replacements:fastify-basic-auth-to-scoped',
      'replacements:fastify-bearer-auth-to-scoped',
      'replacements:fastify-caching-to-scoped',
      'replacements:fastify-circuit-breaker-to-scoped',
      'replacements:fastify-compress-to-scoped',
      'replacements:fastify-cookie-to-scoped',
      'replacements:fastify-cors-to-scoped',
      'replacements:fastify-diagnostics-channel-to-scoped',
      'replacements:fastify-elasticsearch-to-scoped',
      'replacements:fastify-env-to-scoped',
      'replacements:fastify-error-to-scoped',
      'replacements:fastify-etag-to-scoped',
      'replacements:fastify-express-to-scoped',
      'replacements:fastify-flash-to-scoped',
      'replacements:fastify-formbody-to-scoped',
      'replacements:fastify-funky-to-scoped',
      'replacements:fastify-helmet-to-scoped',
      'replacements:fastify-hotwire-to-scoped',
      'replacements:fastify-http-proxy-to-scoped',
      'replacements:fastify-jwt-to-scoped',
      'replacements:fastify-kafka-to-scoped',
      'replacements:fastify-leveldb-to-scoped',
      'replacements:fastify-mongodb-to-scoped',
      'replacements:fastify-multipart-to-scoped',
      'replacements:fastify-mysql-to-scoped',
      'replacements:fastify-nextjs-to-scoped',
      'replacements:fastify-oauth2-to-scoped',
      'replacements:fastify-passport-to-scoped',
      'replacements:fastify-postgres-to-scoped',
      'replacements:fastify-rate-limit-to-scoped',
      'replacements:fastify-redis-to-scoped',
      'replacements:fastify-reply-from-to-scoped',
      'replacements:fastify-request-context-to-scoped',
      'replacements:fastify-response-validation-to-scoped',
      'replacements:fastify-routes-stats-to-scoped',
      'replacements:fastify-routes-to-scoped',
      'replacements:fastify-schedule-to-scoped',
      'replacements:fastify-secure-session-to-scoped',
      'replacements:fastify-sensible-to-scoped',
      'replacements:fastify-soap-client-to-scoped',
      'replacements:fastify-static-to-scoped',
      'replacements:fastify-swagger-to-scoped',
      'replacements:fastify-url-data-to-scoped',
      'replacements:fastify-websocket-to-scoped',
      'replacements:fastify-zipkin-to-scoped',
      'replacements:hapi-to-scoped',
      'replacements:jade-to-pug',
      'replacements:joi-to-scoped',
      'replacements:joi-to-unscoped',
      'replacements:middie-to-scoped',
      'replacements:now-to-vercel',
      'replacements:parcel-css-to-lightningcss',
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
  'fastify-accepts-serializer-to-scoped': {
    description: '`fastify-accepts-serializer` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.3.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-accepts-serializer'],
        replacementName: '@fastify/accepts-serializer',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'fastify-accepts-to-scoped': {
    description: '`fastify-accepts` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=2.3.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-accepts'],
        replacementName: '@fastify/accepts',
        replacementVersion: '3.0.0',
      },
    ],
  },
  'fastify-auth-to-scoped': {
    description: '`fastify-auth` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=1.2.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-auth'],
        replacementName: '@fastify/auth',
        replacementVersion: '2.0.0',
      },
    ],
  },
  'fastify-autoload-to-scoped': {
    description: '`fastify-autoload` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.13.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-autoload'],
        replacementName: '@fastify/autoload',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'fastify-awilix-to-scoped': {
    description: '`fastify-awilix` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=1.3.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-awilix'],
        replacementName: '@fastify/awilix',
        replacementVersion: '2.0.0',
      },
    ],
  },
  'fastify-basic-auth-to-scoped': {
    description: '`fastify-basic-auth` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=2.3.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-basic-auth'],
        replacementName: '@fastify/basic-auth',
        replacementVersion: '3.0.0',
      },
    ],
  },
  'fastify-bearer-auth-to-scoped': {
    description: '`fastify-bearer-auth` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=6.3.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-bearer-auth'],
        replacementName: '@fastify/bearer-auth',
        replacementVersion: '7.0.0',
      },
    ],
  },
  'fastify-caching-to-scoped': {
    description: '`fastify-caching` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=6.3.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-caching'],
        replacementName: '@fastify/caching',
        replacementVersion: '7.0.0',
      },
    ],
  },
  'fastify-circuit-breaker-to-scoped': {
    description: '`fastify-circuit-breaker` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=1.2.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-circuit-breaker'],
        replacementName: '@fastify/circuit-breaker',
        replacementVersion: '2.0.0',
      },
    ],
  },
  'fastify-compress-to-scoped': {
    description: '`fastify-compress` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=4.1.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-compress'],
        replacementName: '@fastify/compress',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'fastify-cookie-to-scoped': {
    description: '`fastify-cookie` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=5.7.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-cookie'],
        replacementName: '@fastify/cookie',
        replacementVersion: '6.0.0',
      },
    ],
  },
  'fastify-cors-to-scoped': {
    description: '`fastify-cors` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=6.1.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-cors'],
        replacementName: '@fastify/cors',
        replacementVersion: '7.0.0',
      },
    ],
  },
  'fastify-diagnostics-channel-to-scoped': {
    description: '`fastify-diagnostics-channel` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=1.1.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-diagnostics-channel'],
        replacementName: '@fastify/diagnostics-channel',
        replacementVersion: '2.0.0',
      },
    ],
  },
  'fastify-elasticsearch-to-scoped': {
    description: '`fastify-elasticsearch` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=1.2.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-elasticsearch'],
        replacementName: '@fastify/elasticsearch',
        replacementVersion: '2.0.0',
      },
    ],
  },
  'fastify-env-to-scoped': {
    description: '`fastify-env` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=2.2.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-env'],
        replacementName: '@fastify/env',
        replacementVersion: '3.0.0',
      },
    ],
  },
  'fastify-error-to-scoped': {
    description: '`fastify-error` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=1.2.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-error'],
        replacementName: '@fastify/error',
        replacementVersion: '2.0.0',
      },
    ],
  },
  'fastify-etag-to-scoped': {
    description: '`fastify-etag` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=2.2.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-etag'],
        replacementName: '@fastify/etag',
        replacementVersion: '3.0.0',
      },
    ],
  },
  'fastify-express-to-scoped': {
    description: '`fastify-express` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=0.4.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-express'],
        replacementName: '@fastify/express',
        replacementVersion: '1.0.0',
      },
    ],
  },
  'fastify-flash-to-scoped': {
    description: '`fastify-flash` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.1.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-flash'],
        replacementName: '@fastify/flash',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'fastify-formbody-to-scoped': {
    description: '`fastify-formbody` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=5.3.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-formbody'],
        replacementName: '@fastify/formbody',
        replacementVersion: '6.0.0',
      },
    ],
  },
  'fastify-funky-to-scoped': {
    description: '`fastify-funky` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=1.1.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-funky'],
        replacementName: '@fastify/funky',
        replacementVersion: '2.0.0',
      },
    ],
  },
  'fastify-helmet-to-scoped': {
    description: '`fastify-helmet` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=7.1.0 <8.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-helmet'],
        replacementName: '@fastify/helmet',
        replacementVersion: '8.0.0',
      },
    ],
  },
  'fastify-hotwire-to-scoped': {
    description: '`fastify-hotwire` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=0.3.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-hotwire'],
        replacementName: '@fastify/hotwire',
        replacementVersion: '1.0.0',
      },
    ],
  },
  'fastify-http-proxy-to-scoped': {
    description: '`fastify-http-proxy` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=6.3.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-http-proxy'],
        replacementName: '@fastify/http-proxy',
        replacementVersion: '7.0.0',
      },
    ],
  },
  'fastify-jwt-to-scoped': {
    description: '`fastify-jwt` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=4.2.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-jwt'],
        replacementName: '@fastify/jwt',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'fastify-kafka-to-scoped': {
    description: '`fastify-kafka` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=0.3.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-kafka'],
        replacementName: '@fastify/kafka',
        replacementVersion: '1.0.0',
      },
    ],
  },
  'fastify-leveldb-to-scoped': {
    description: '`fastify-leveldb` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.2.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-leveldb'],
        replacementName: '@fastify/leveldb',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'fastify-mongodb-to-scoped': {
    description: '`fastify-mongodb` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=4.2.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-mongodb'],
        replacementName: '@fastify/mongodb',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'fastify-multipart-to-scoped': {
    description: '`fastify-multipart` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=5.4.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-multipart'],
        replacementName: '@fastify/multipart',
        replacementVersion: '6.0.0',
      },
    ],
  },
  'fastify-mysql-to-scoped': {
    description: '`fastify-mysql` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=2.2.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-mysql'],
        replacementName: '@fastify/mysql',
        replacementVersion: '3.0.0',
      },
    ],
  },
  'fastify-nextjs-to-scoped': {
    description: '`fastify-nextjs` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=7.3.0 <8.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-nextjs'],
        replacementName: '@fastify/nextjs',
        replacementVersion: '8.0.0',
      },
    ],
  },
  'fastify-oauth2-to-scoped': {
    description: '`fastify-oauth2` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=4.6.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-oauth2'],
        replacementName: '@fastify/oauth2',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'fastify-passport-to-scoped': {
    description: '`fastify-passport` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=0.5.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-passport'],
        replacementName: '@fastify/passport',
        replacementVersion: '1.0.0',
      },
    ],
  },
  'fastify-postgres-to-scoped': {
    description: '`fastify-postgres` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.7.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-postgres'],
        replacementName: '@fastify/postgres',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'fastify-rate-limit-to-scoped': {
    description: '`fastify-rate-limit` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=5.9.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-rate-limit'],
        replacementName: '@fastify/rate-limit',
        replacementVersion: '6.0.0',
      },
    ],
  },
  'fastify-redis-to-scoped': {
    description: '`fastify-redis` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=4.4.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-redis'],
        replacementName: '@fastify/redis',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'fastify-reply-from-to-scoped': {
    description: '`fastify-reply-from` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=6.7.0 <7.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-reply-from'],
        replacementName: '@fastify/reply-from',
        replacementVersion: '7.0.0',
      },
    ],
  },
  'fastify-request-context-to-scoped': {
    description: '`fastify-request-context` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=2.3.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-request-context'],
        replacementName: '@fastify/request-context',
        replacementVersion: '3.0.0',
      },
    ],
  },
  'fastify-response-validation-to-scoped': {
    description: '`fastify-response-validation` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=0.3.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-response-validation'],
        replacementName: '@fastify/response-validation',
        replacementVersion: '1.0.0',
      },
    ],
  },
  'fastify-routes-stats-to-scoped': {
    description: '`fastify-routes-stats` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=2.1.0 <3.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-routes-stats'],
        replacementName: '@fastify/routes-stats',
        replacementVersion: '3.0.0',
      },
    ],
  },
  'fastify-routes-to-scoped': {
    description: '`fastify-routes` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.2.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-routes'],
        replacementName: '@fastify/routes',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'fastify-schedule-to-scoped': {
    description: '`fastify-schedule` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=1.1.0 <2.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-schedule'],
        replacementName: '@fastify/schedule',
        replacementVersion: '2.0.0',
      },
    ],
  },
  'fastify-secure-session-to-scoped': {
    description: '`fastify-secure-session` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.2.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-secure-session'],
        replacementName: '@fastify/secure-session',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'fastify-sensible-to-scoped': {
    description: '`fastify-sensible` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.2.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-sensible'],
        replacementName: '@fastify/sensible',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'fastify-soap-client-to-scoped': {
    description: '`fastify-soap-client` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=0.3.0 <1.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-soap-client'],
        replacementName: '@fastify/soap-client',
        replacementVersion: '1.0.0',
      },
    ],
  },
  'fastify-static-to-scoped': {
    description: '`fastify-static` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=4.7.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-static'],
        replacementName: '@fastify/static',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'fastify-swagger-to-scoped': {
    description: '`fastify-swagger` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=5.2.0 <6.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-swagger'],
        replacementName: '@fastify/swagger',
        replacementVersion: '6.0.0',
      },
    ],
  },
  'fastify-url-data-to-scoped': {
    description: '`fastify-url-data` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=3.1.0 <4.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-url-data'],
        replacementName: '@fastify/url-data',
        replacementVersion: '4.0.0',
      },
    ],
  },
  'fastify-websocket-to-scoped': {
    description: '`fastify-websocket` became scoped.',
    packageRules: [
      {
        matchCurrentVersion: '>=4.3.0 <5.0.0',
        matchDatasources: ['npm'],
        matchPackageNames: ['fastify-websocket'],
        replacementName: '@fastify/websocket',
        replacementVersion: '5.0.0',
      },
    ],
  },
  'fastify-zipkin-to-scoped': {
    description: '`fastify-zipkin` became scoped.',
    packageRules: [
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
  'parcel-css-to-lightningcss': {
    description: '`@parcel/css` was renamed `lightningcss`.',
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

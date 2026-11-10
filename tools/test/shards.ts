import type { ShardConfig } from './types.ts';

/**
 * Configuration for test shards that can be run with `TEST_SHARD` environment variable.
 *
 * For each shard, we specify a subset of tests to run.
 * The tests from previous shards are excluded from the next shard.
 *
 * Storing shards config in the separate file helps to form CI matrix
 * using pre-installed `jq` utility.
 */
export const testShards: Record<string, ShardConfig> = {
  versioning: {
    matchPaths: [
      'lib/modules/versioning',
      'lib/modules/datasource/*.spec.ts',
      'lib/modules/manager/*.spec.ts',
    ],
  },
  'datasources-1': {
    matchPaths: ['lib/modules/datasource/[a-g]*'],
  },
  'datasources-2': {
    matchPaths: ['lib/modules/datasource'],
  },
  'managers-1': {
    matchPaths: ['lib/modules/manager/[a-d]*'],
  },
  'managers-2': {
    matchPaths: ['lib/modules/manager/[e-g]*'],
  },
  'managers-3': {
    matchPaths: ['lib/modules/manager/[h-m]*'],
  },
  'managers-4': {
    matchPaths: ['lib/modules/manager/[n-o]*'],
  },
  'managers-5': {
    matchPaths: ['lib/modules/manager'],
  },
  platform: {
    matchPaths: ['lib/modules/platform'],
  },
  git: {
    matchPaths: ['lib/util/git'],
  },
  'workers-1': {
    matchPaths: [
      'lib/config/migrations',
      'lib/workers/global',
      'lib/workers/repository/changelog',
      'lib/workers/repository/config-migration',
      'lib/workers/repository/finalize',
      'lib/workers/repository/init',
    ],
  },
  'workers-3': {
    matchPaths: [
      'lib/workers/repository/model',
      'lib/workers/repository/update',
      'lib/workers/repository/updates',
    ],
  },
  'workers-2': {
    matchPaths: ['lib/workers'],
  },
  util: {
    matchPaths: ['lib/util'],
  },
  tools: {
    matchPaths: ['tools'],
  },
  config: {
    matchPaths: ['lib'],
  },
};

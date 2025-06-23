import type { ShardConfig } from './types';

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
  'datasources-1': {
    matchPaths: ['lib/modules/datasource/[a-g]*'],
  },
  'datasources-2': {
    matchPaths: ['lib/modules/datasource'],
  },
  'managers-1': {
    matchPaths: ['lib/modules/manager/[a-c]*'],
  },
  'managers-2': {
    matchPaths: ['lib/modules/manager/[d-h]*'],
  },
  'managers-3': {
    matchPaths: ['lib/modules/manager/[i-n]*'],
  },
  'managers-4': {
    matchPaths: ['lib/modules/manager'],
  },
  platform: {
    matchPaths: ['lib/modules/platform'],
  },
  versioning: {
    matchPaths: ['lib/modules/versioning'],
  },
  'workers-1': {
    matchPaths: [
      'lib/workers/repository/changelog',
      'lib/workers/repository/config-migration',
      'lib/workers/repository/extract',
      'lib/workers/repository/finalize',
      'lib/workers/repository/init',
      'lib/workers/repository/model',
    ],
  },
  'workers-2': {
    matchPaths: [
      'lib/workers/repository/onboarding',
      'lib/workers/repository/process',
    ],
  },
  'workers-3': {
    matchPaths: [
      'lib/workers/repository/update',
      'lib/workers/repository/updates',
    ],
  },
  'workers-4': {
    matchPaths: ['lib/workers'],
  },
  'git-1': {
    matchPaths: ['lib/util/git/index.spec.ts'],
  },
  'git-2': {
    matchPaths: ['lib/util/git'],
  },
  util: {
    matchPaths: ['lib/util'],
  },
  other: {
    matchPaths: ['lib'],
  },
};

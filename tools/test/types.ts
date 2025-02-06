import type { JestConfigWithTsJest } from 'ts-jest';

/**
 * Configuration for single test shard.
 */
export interface ShardConfig {
  /**
   * Path patterns to match against the test file paths, of two types:
   *
   * 1. Particular file, e.g. `lib/util/git/index.spec.ts`
   *
   *    - File pattern MUST end with `.spec.ts`
   *    - This will only search for the particular test file
   *    - It enables coverage for the `*.ts` file with the same name,
   *      e.g. `lib/util/git/index.ts`
   *    - You probably want to use directory pattern instead
   *
   * 2. Whole directory, e.g. `lib/modules/datasource`
   *
   *    - This will search for all `*.spec.ts` files under the directory
   *    - It enables coverage all `*.ts` files under the directory,
   *      e.g. `lib/modules/datasource/foo/bar/baz.ts`
   */
  matchPaths: string[];
}

export type RunsOn = 'ubuntu-latest' | 'windows-latest' | 'macos-latest';

export interface ShardGroup {
  /**
   * Input for `runs-on` field.
   */
  os: RunsOn;

  /**
   * Controls whether coverage is collected for this shard group.
   */
  coverage: boolean;

  /**
   * Input for `name` field.
   */
  name: string;

  /**
   * Space-separated list of shard keys, it's
   * meant to be inserted into bash for-loop.
   */
  shards: string;

  /**
   * It's meant to be used for Jest caching.
   */
  'cache-key': string;

  /**
   * It's used to set test runner timeout.
   */
  'runner-timeout-minutes': number;

  /**
   * It's used to set `--test-timeout` Jest CLI flag.
   */
  'test-timeout-milliseconds': number;

  /**
   * It's used as the name for coverage artifact.
   */
  'upload-artifact-name': string;
}

export type JestConfig = JestConfigWithTsJest & {
  // https://github.com/renovatebot/renovate/issues/17034
  workerIdleMemoryLimit?: string;
};

/**
 * Subset of Jest config that is relevant for sharded test run.
 */
export type JestShardedSubconfig = Pick<
  JestConfig,
  'testMatch' | 'coverageDirectory'
>;

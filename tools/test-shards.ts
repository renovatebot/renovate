import crypto from 'node:crypto';
import { globSync } from 'glob';
import { minimatch } from 'minimatch';
import { testShards } from './test/shards.ts';
import type { RunsOn, ShardGroup } from './test/types.ts';

const TOTAL_SHARDS = Object.keys(testShards).length;

function toMatchPattern(path: string): string {
  return path.endsWith('.spec.ts')
    ? path.replace(/\.spec\.ts$/, '{.ts,.spec.ts}')
    : `${path}/**/*`;
}

/**
 * Given the file list affected by commit, return the list
 * of shards that test these changes.
 *
 * Exported for reuse in local-ci tooling.
 */
export function getMatchingShards(files: string[]): string[] {
  const matchingShards = new Set<string>();
  for (const file of files) {
    // Only lib/ files can match test shards
    if (!file.startsWith('lib/')) {
      continue;
    }
    for (const [key, { matchPaths }] of Object.entries(testShards)) {
      const patterns = matchPaths.map(toMatchPattern);

      if (patterns.some((pattern) => minimatch(file, pattern))) {
        matchingShards.add(key);
        break;
      }
    }
  }

  return Object.keys(testShards).filter((shard) => matchingShards.has(shard));
}

export { TOTAL_SHARDS };

/**
 * Convert shard names to vitest-compatible test file patterns.
 *
 * Vitest CLI filters are substring/regex matches, not globs.
 * This expands glob patterns (like [a-c]*) into actual paths.
 */
export function getTestPatternsForShards(shardNames: string[]): string[] {
  const patterns: string[] = [];
  for (const name of shardNames) {
    const shard = testShards[name];
    for (const path of shard.matchPaths) {
      // Specific .spec.ts files pass through directly
      if (path.endsWith('.spec.ts')) {
        patterns.push(path);
        continue;
      }

      const isGlobPattern = path.includes('[') || path.includes('*');
      if (isGlobPattern) {
        const expanded = globSync(path, { nodir: false });
        patterns.push(...expanded);
      } else {
        patterns.push(path);
      }
    }
  }
  return patterns;
}

/**
 * Distribute items evenly across runner instances.
 */
function scheduleItems<T>(items: T[], availableInstances: number): T[][] {
  const numInstances = Math.min(items.length, availableInstances);
  const maxPerInstance = Math.ceil(items.length / numInstances);
  const lighterInstancesIdx =
    items.length % numInstances === 0
      ? numInstances
      : items.length % numInstances;

  const partitionSizes = Array.from({ length: numInstances }, (_, idx) =>
    idx < lighterInstancesIdx ? maxPerInstance : maxPerInstance - 1,
  );

  const result: T[][] = Array.from({ length: numInstances }, () => []);
  let rest = items.slice();
  for (let idx = 0; idx < numInstances; idx += 1) {
    const partitionSize = partitionSizes[idx];
    const partition = rest.slice(0, partitionSize);
    result[idx] = partition;
    rest = rest.slice(partitionSize);
  }

  return result;
}

/**
 * Main function for CI shard scheduling.
 * Only runs when SCHEDULE_TEST_SHARDS=true is set.
 */
function main(): void {
  let shardKeys = Object.keys(testShards);

  if (process.env.FILTER_SHARDS === 'true' && process.env.CHANGED_FILES) {
    try {
      const changedFiles: string[] = JSON.parse(process.env.CHANGED_FILES);
      const matchingShards = getMatchingShards(changedFiles);
      if (matchingShards.length === 0) {
        console.log(`test-matrix-empty=true`);
        process.exit(0);
      }
      shardKeys = shardKeys.filter((key) => matchingShards.includes(key));
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }

  /**
   * Not all runners are created equal.
   * Minutes cost proportion is 1:2:10 for Ubuntu:Windows:MacOS.
   *
   * Although it's free in our case,
   * we can't run as many Windows and MacOS runners as we want.
   *
   * Because of this, we partition shards into groups, given that:
   * - There are 16 shards in total
   * - We can't run more than 10 Windows runners
   * - We can't run more than 5 MacOS runners
   */
  const shardGrouping: Record<string, string[][]> = {
    'ubuntu-latest': scheduleItems(shardKeys, 16),
  };

  if (process.env.ALL_PLATFORMS === 'true') {
    // shardGrouping['windows-latest'] = scheduleItems(shardKeys, 8);
    shardGrouping['macos-latest'] = scheduleItems(shardKeys, 4);
  }

  const shardGroups: ShardGroup[] = [];
  for (const [os, groups] of Object.entries(shardGrouping)) {
    const coverage = os === 'ubuntu-latest';

    const total = groups.length;
    for (let idx = 0; idx < groups.length; idx += 1) {
      const number = idx + 1;
      const platform = os.replace(/-latest$/, '');
      const name =
        platform === 'ubuntu'
          ? `test (${number}/${total})`
          : `test-${platform} (${number}/${total})`;

      const shards = groups[idx];
      const cacheKey = crypto
        .createHash('md5')
        .update(shards.join(':'))
        .digest('hex');

      const runnerTimeoutMinutes =
        {
          ubuntu: 10,
          windows: 20,
          macos: 20,
        }[platform] ?? 20;

      const testTimeoutMilliseconds =
        {
          windows: 240000,
        }[platform] ?? 120000;

      shardGroups.push({
        os: os as RunsOn,
        coverage,
        name,
        shards: shards.join(' '),
        'cache-key': cacheKey,
        'runner-timeout-minutes': runnerTimeoutMinutes,
        'test-timeout-milliseconds': testTimeoutMilliseconds,
        'upload-artifact-name': `coverage-${shards.sort().join('_')}`,
      });
    }
  }

  /**
   * Output will be consumed by `setup` CI job.
   */
  console.log(`test-shard-matrix=${JSON.stringify(shardGroups)}`);
}

// Only run main when invoked as a script (not when imported)
if (process.env.SCHEDULE_TEST_SHARDS === 'true') {
  main();
}

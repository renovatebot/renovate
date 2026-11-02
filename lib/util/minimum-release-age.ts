import { isNonEmptyString } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import type { MinimumReleaseAgeBehaviour } from '../config/types.ts';
import { coerceArray } from './array.ts';
import { getElapsedMs } from './date.ts';
import { coerceNumber } from './number.ts';
import { toMs } from './pretty-time.ts';
import { regEx } from './regex.ts';
import type { Timestamp } from './timestamp.ts';

export interface MinimumReleaseAgeCheckResult {
  isPending: boolean;
  /** Effective minimum release age, including `minimumReleaseAgeBuffer`. */
  minimumReleaseAgeMs: number;
  hasTimestamp: boolean;
}

export interface MinimumReleaseAgeConfig {
  isVulnerabilityAlert?: boolean;
  minimumReleaseAge?: string | null;
  minimumReleaseAgeBuffer?: string | null;
  /**
   * The minimum release age which a manager extracted from the package
   * manager's own configuration, as a duration or an ISO 8601 date. A date
   * counts as the time elapsed since that date.
   */
  minimumReleaseAgeExtracted?: string | null;
}

const isoDateRegex = regEx(/^\d{4}-\d{2}-\d{2}/);

function durationToMs(duration: string | null | undefined): number {
  return isNonEmptyString(duration) ? coerceNumber(toMs(duration), 0) : 0;
}

/**
 * Converts a duration, or an ISO 8601 date as the time elapsed since that
 * date, to milliseconds.
 */
function extractedAgeToMs(age: string | null | undefined): number {
  if (!isNonEmptyString(age) || !isoDateRegex.test(age)) {
    return durationToMs(age);
  }
  const date = DateTime.fromISO(age, { zone: 'utc' });
  if (!date.isValid) {
    return 0;
  }
  return Math.max(Date.now() - date.toMillis(), 0);
}

/**
 * Calculates the effective minimum release age in milliseconds: the larger of
 * `minimumReleaseAge` and `minimumReleaseAgeExtracted`, extended by the
 * `minimumReleaseAgeBuffer` duration if configured.
 *
 * Security updates ignore `minimumReleaseAgeExtracted`, so that Renovate
 * raises them and the package manager reports a fix which is too new.
 */
export function calculateMinimumReleaseAgeMs(
  config: MinimumReleaseAgeConfig,
): number {
  const minimumReleaseAgeMs = Math.max(
    durationToMs(config.minimumReleaseAge),
    config.isVulnerabilityAlert
      ? 0
      : extractedAgeToMs(config.minimumReleaseAgeExtracted),
  );

  if (!minimumReleaseAgeMs) {
    return 0;
  }

  const bufferMs = durationToMs(config.minimumReleaseAgeBuffer);

  return minimumReleaseAgeMs + Math.max(bufferMs, 0);
}

export interface PackageManagerMinimumReleaseAgeConfig {
  isLockFileMaintenance?: boolean;
  isVulnerabilityAlert?: boolean;
  manager?: string | null;
  minimumReleaseAge?: string | null;
  minimumReleaseAgePackageManager?: string | null;
  minimumReleaseAgeRepository?: string | null;
  packageFile?: string | null;
}

export interface PackageManagerMinimumReleaseAgeOptions {
  /** The config of the `updateArtifacts` call, which is the branch config. */
  config: PackageManagerMinimumReleaseAgeConfig & {
    /** All upgrades of the branch. */
    upgrades?: PackageManagerMinimumReleaseAgeConfig[] | null;
  };
  /** The manager which updates the lock file. */
  manager: string;
  /** The package file whose lock file the package manager updates. */
  packageFile: string;
  /** The updates of the lock file, i.e. `updatedDeps` of `updateArtifacts`. */
  upgrades: PackageManagerMinimumReleaseAgeConfig[];
}

function findManagerUpdate(
  updates: PackageManagerMinimumReleaseAgeConfig[],
): PackageManagerMinimumReleaseAgeConfig | undefined {
  return updates.find((update) => update.isLockFileMaintenance) ?? updates[0];
}

/**
 * Calculates the minimum release age in milliseconds which Renovate passes to
 * a package manager when it updates a lock file:
 *
 * - `0` if any update of the lock file is a security update, as these bypass
 *   the minimum release age
 * - the own `minimumReleaseAge` of lock file maintenance
 * - `minimumReleaseAgeRepository` for other updates, as the package manager
 *   applies the value to every package of the lock file, and a larger
 *   `minimumReleaseAge` from `packageRules` would fail on packages which other
 *   updates locked
 *
 * The result is raised to `minimumReleaseAgePackageManager` of the same update
 * if that is larger.
 *
 * The values are set per manager, so it reads them from an update of
 * `manager`, preferring lock file maintenance:
 *
 * 1. from `upgrades`, which can also hold updates of other managers that
 *    extract the same package file
 * 2. from the upgrades of the branch for `packageFile`, e.g. for lock file
 *    maintenance, which is called without upgrades
 * 3. from `config`, the branch config, which is the one of the first upgrade of
 *    the branch and can belong to another manager
 *
 * `minimumReleaseAgeExtracted` and `minimumReleaseAgeBuffer` are not included,
 * as the package manager applies its own value itself.
 */
export function calculatePackageManagerMinimumReleaseAgeMs({
  config,
  manager,
  packageFile,
  upgrades,
}: PackageManagerMinimumReleaseAgeOptions): number {
  const update =
    findManagerUpdate(
      upgrades.filter((upgrade) => upgrade.manager === manager),
    ) ??
    findManagerUpdate(
      coerceArray(config.upgrades).filter(
        (upgrade) =>
          upgrade.manager === manager && upgrade.packageFile === packageFile,
      ),
    ) ??
    config;
  if ([...upgrades, update].some((upgrade) => upgrade.isVulnerabilityAlert)) {
    return 0;
  }
  const baseMs = durationToMs(
    update.isLockFileMaintenance
      ? update.minimumReleaseAge
      : update.minimumReleaseAgeRepository,
  );
  return Math.max(baseMs, durationToMs(update.minimumReleaseAgePackageManager));
}

/**
 * Checks whether a release satisfies the effective minimum release age.
 *
 * Separate from `internalChecksFilter` to allow reuse, and lives here so that
 * managers can import it without an import cycle.
 *
 * @see calculateMinimumReleaseAgeMs
 */
export function checkMinimumReleaseAge(
  config: MinimumReleaseAgeConfig & {
    minimumReleaseAgeBehaviour?: MinimumReleaseAgeBehaviour | null;
  },
  releaseTimestamp: Timestamp | null | undefined,
): MinimumReleaseAgeCheckResult {
  const minimumReleaseAgeMs = calculateMinimumReleaseAgeMs(config);

  if (!minimumReleaseAgeMs) {
    return {
      isPending: false,
      minimumReleaseAgeMs,
      hasTimestamp: !!releaseTimestamp,
    };
  }

  if (releaseTimestamp) {
    return {
      isPending: getElapsedMs(releaseTimestamp) < minimumReleaseAgeMs,
      minimumReleaseAgeMs,
      hasTimestamp: true,
    };
  }

  return {
    isPending: config.minimumReleaseAgeBehaviour === 'timestamp-required',
    minimumReleaseAgeMs,
    hasTimestamp: false,
  };
}

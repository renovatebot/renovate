import { isNonEmptyString } from '@sindresorhus/is';
import type { MinimumReleaseAgeBehaviour } from '../config/types.ts';
import { getElapsedMs } from './date.ts';
import { coerceNumber } from './number.ts';
import { toMs } from './pretty-time.ts';
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
  /** The minimum release age which a manager extracted from the package manager's own configuration. */
  minimumReleaseAgeExtracted?: string | null;
}

function durationToMs(duration: string | null | undefined): number {
  return isNonEmptyString(duration) ? coerceNumber(toMs(duration), 0) : 0;
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
      : durationToMs(config.minimumReleaseAgeExtracted),
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
  minimumReleaseAge?: string | null;
  minimumReleaseAgeRepository?: string | null;
}

/**
 * Calculates the minimum release age in milliseconds which Renovate passes to
 * a package manager when it updates a lock file:
 *
 * - `0` for security updates, which bypass the minimum release age
 * - the own `minimumReleaseAge` of lock file maintenance
 * - `minimumReleaseAgeRepository` for other updates, as the package manager
 *   applies the value to every package of the lock file, and a larger
 *   `minimumReleaseAge` from `packageRules` would fail on packages which other
 *   updates locked
 *
 * It reads `upgrades`, the updates of the lock file, as the branch config is
 * the one of the first upgrade of the branch, which can belong to another
 * manager. Without upgrades, e.g. for lock file maintenance, it reads `config`.
 *
 * `minimumReleaseAgeExtracted` and `minimumReleaseAgeBuffer` are not included,
 * as the package manager applies its own value itself.
 */
export function calculatePackageManagerMinimumReleaseAgeMs(
  config: PackageManagerMinimumReleaseAgeConfig,
  upgrades: PackageManagerMinimumReleaseAgeConfig[] = [],
): number {
  const updates = upgrades.length ? upgrades : [config];
  if (updates.some((update) => update.isVulnerabilityAlert)) {
    return 0;
  }
  const lockFileMaintenance = updates.find(
    (update) => update.isLockFileMaintenance,
  );
  return durationToMs(
    lockFileMaintenance
      ? lockFileMaintenance.minimumReleaseAge
      : updates[0].minimumReleaseAgeRepository,
  );
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

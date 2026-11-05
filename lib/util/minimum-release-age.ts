import { isNonEmptyString, isString } from '@sindresorhus/is';
import type { MinimumReleaseAgeBehaviour } from '../config/types.ts';
import { coerceArray } from './array.ts';
import { getElapsedMs } from './date.ts';
import { coerceNumber } from './number.ts';
import { toMs } from './pretty-time.ts';
import { UtcDate } from './schema-utils/index.ts';
import { uniqueStrings } from './string.ts';
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

function durationToMs(duration: string | null | undefined): number {
  return isNonEmptyString(duration) ? coerceNumber(toMs(duration), 0) : 0;
}

/**
 * Converts a duration, or an ISO 8601 date as the time elapsed since that
 * date, to milliseconds.
 */
function extractedAgeToMs(age: string | null | undefined): number {
  const date = UtcDate.safeParse(age);
  if (!date.success) {
    return durationToMs(age);
  }
  return Math.max(Date.now() - date.data.toMillis(), 0);
}

/**
 * Calculates the effective minimum release age in milliseconds: the larger of
 * `minimumReleaseAge` and `minimumReleaseAgeExtracted`, extended by the
 * `minimumReleaseAgeBuffer` duration if configured.
 *
 * Security updates ignore `minimumReleaseAgeExtracted`.
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
  minimumReleaseAgePackageManagerSync?: boolean;
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
 * Selects the update whose config applies to the lock file. The values are set
 * per manager, so it selects an update of `manager`, preferring lock file
 * maintenance:
 *
 * 1. from `upgrades`, which can also hold updates of other managers that
 *    extract the same package file
 * 2. from the upgrades of the branch for `packageFile`, e.g. for lock file
 *    maintenance, which is called without upgrades
 * 3. `config`, the branch config, which is the one of the first upgrade of the
 *    branch and can belong to another manager
 */
function findPackageManagerUpdate({
  config,
  manager,
  packageFile,
  upgrades,
}: PackageManagerMinimumReleaseAgeOptions): PackageManagerMinimumReleaseAgeConfig {
  const packageFileUpgrades = coerceArray(config.upgrades).filter(
    (upgrade) =>
      upgrade.manager === manager && upgrade.packageFile === packageFile,
  );
  return (
    findManagerUpdate(
      upgrades.filter((upgrade) => upgrade.manager === manager),
    ) ??
    findManagerUpdate(packageFileUpgrades) ??
    config
  );
}

/**
 * Calculates the minimum release age in milliseconds which Renovate passes to
 * a package manager when it updates the lock file of `packageFile`: `0` if any
 * update of the lock file is a security update, the own `minimumReleaseAge` for
 * lock file maintenance, else `minimumReleaseAgeRepository`, raised to
 * `minimumReleaseAgePackageManager` if that is larger. Returns `null` if the
 * update of `manager` does not enable `minimumReleaseAgePackageManagerSync`.
 */
export function calculatePackageManagerMinimumReleaseAgeMs(
  options: PackageManagerMinimumReleaseAgeOptions,
): number | null {
  const update = findPackageManagerUpdate(options);
  if (!update.minimumReleaseAgePackageManagerSync) {
    return null;
  }
  if (
    [...options.upgrades, update].some(
      (upgrade) => upgrade.isVulnerabilityAlert,
    )
  ) {
    return 0;
  }
  const baseMs = durationToMs(
    update.isLockFileMaintenance
      ? update.minimumReleaseAge
      : update.minimumReleaseAgeRepository,
  );
  return Math.max(baseMs, durationToMs(update.minimumReleaseAgePackageManager));
}

export interface MinimumReleaseAgeExemptionConfig
  extends MinimumReleaseAgeConfig, PackageManagerMinimumReleaseAgeConfig {
  datasource?: string;
  depName?: string;
  releaseTimestamp?: Timestamp | null;
}

export interface MinimumReleaseAgeExemption<
  T extends MinimumReleaseAgeExemptionConfig = MinimumReleaseAgeExemptionConfig,
> {
  /** The smallest own minimum release age of the exempted updates, without `minimumReleaseAgeBuffer`. */
  ageMs: number;
  /** The `depName` of each exempted update. */
  depNames: string[];
  /** The exempted updates. */
  upgrades: T[];
}

/**
 * Whether the release of `upgrade` is at least `ageMs` old, where a release
 * without a timestamp passes only an age of `0`.
 */
export function isReleaseOldEnough(
  upgrade: { releaseTimestamp?: Timestamp | null },
  ageMs: number,
): boolean {
  if (!ageMs) {
    return true;
  }
  return (
    !!upgrade.releaseTimestamp &&
    getElapsedMs(upgrade.releaseTimestamp) >= ageMs
  );
}

/**
 * The own minimum release age of `upgrade` without `minimumReleaseAgeBuffer`.
 */
function getOwnAgeMs(upgrade: MinimumReleaseAgeExemptionConfig): number {
  return calculateMinimumReleaseAgeMs({
    ...upgrade,
    minimumReleaseAgeBuffer: null,
  });
}

/**
 * Returns the updates of `manager` and `datasource` in `upgrades` which enable `minimumReleaseAgePackageManagerSync`, other than lock file maintenance and security updates, whose own minimum release age without `minimumReleaseAgeBuffer` is smaller than `ageMs` and whose release is younger than `ageMs` or has no timestamp, or `null` if there are none. Callers pass only the updates of one lock file.
 */
export function getMinimumReleaseAgeExemption<
  T extends MinimumReleaseAgeExemptionConfig,
>(
  upgrades: T[],
  manager: string,
  datasource: string,
  ageMs: number,
): MinimumReleaseAgeExemption<T> | null {
  const exempted = upgrades.filter(
    (upgrade) =>
      upgrade.manager === manager &&
      upgrade.datasource === datasource &&
      upgrade.minimumReleaseAgePackageManagerSync === true &&
      !upgrade.isLockFileMaintenance &&
      !upgrade.isVulnerabilityAlert &&
      getOwnAgeMs(upgrade) < ageMs &&
      !isReleaseOldEnough(upgrade, ageMs),
  );
  if (!exempted.length) {
    return null;
  }
  return {
    ageMs: Math.min(...exempted.map(getOwnAgeMs)),
    depNames: exempted
      .map((upgrade) => upgrade.depName)
      .filter(isString)
      .filter(uniqueStrings),
    upgrades: exempted,
  };
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

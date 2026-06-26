import { isNonEmptyString, isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import type { Upgrade } from '../../types.ts';

/**
 * Package/version that failed pnpm's minimumReleaseAge during resolution.
 * Parsed from ERR_PNPM_NO_MATURE_MATCHING_VERSION stderr.
 */
export interface PnpmImmaturePackageVersion {
  packageName: string;
  version: string;
}

/** Max maturity-retry rounds (each may add one exclude) to avoid infinite loops. */
export const PNPM_MATURITY_MAX_RETRIES = 15;

/**
 * Parse pnpm's maturity failure from install/update stderr.
 *
 * Example stderr fragment:
 *   ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version 3.0.97 (released 2 days ago) of @ai-sdk/xai does not meet the minimumReleaseAge constraint
 */
export function parsePnpmNoMatureMatchingVersion(
  stderr: string | null | undefined,
): PnpmImmaturePackageVersion | null {
  if (!isNonEmptyString(stderr)) {
    return null;
  }
  if (!stderr.includes('ERR_PNPM_NO_MATURE_MATCHING_VERSION')) {
    return null;
  }

  // Prefer the dedicated error code line; fall back to the prose sentence.
  const versionOfPackage =
    /ERR_PNPM_NO_MATURE_MATCHING_VERSION[^\n]*Version\s+(\S+)\s+\([^)]*\)\s+of\s+(\S+)\s+does not meet/i.exec(
      stderr,
    );
  if (versionOfPackage) {
    return {
      version: versionOfPackage[1],
      packageName: versionOfPackage[2],
    };
  }

  const prose =
    /Version\s+(\S+)\s+\([^)]*\)\s+of\s+(\S+)\s+does not meet the minimumReleaseAge/i.exec(
      stderr,
    );
  if (prose) {
    return { version: prose[1], packageName: prose[2] };
  }

  return null;
}

/**
 * True if the existing lockfile already pins this package at this version.
 * Accepts lockfile v6+ package keys (`'@scope/pkg@1.2.3':` / `'pkg@1.2.3':`)
 * and older path-style keys (`/@scope/pkg@1.2.3(...)` / `/pkg@1.2.3(...)`).
 *
 * Used to decide whether a maturity failure is for a version **already accepted
 * on the base branch** (safe to exclude for regen) vs a **new** selection that
 * should stay blocked by minimumReleaseAge.
 */
export function lockfileContainsPackageVersion(
  lockfileContent: string | null | undefined,
  packageName: string,
  version: string,
): boolean {
  if (!isNonEmptyString(lockfileContent) || !isNonEmptyString(packageName)) {
    return false;
  }
  if (!isNonEmptyString(version)) {
    return false;
  }

  const key = `${packageName}@${version}`;

  // Package key (lockfile v9 / catalogs era) — quoted or bare
  if (
    lockfileContent.includes(`'${key}':`) ||
    lockfileContent.includes(`"${key}":`) ||
    lockfileContent.includes(`${key}:`)
  ) {
    return true;
  }

  // Path-style (older pnpm lockfiles)
  // e.g. /@ai-sdk/xai@3.0.97(zod@4.3.6):  or  /lodash@4.17.21:
  const escapedName = packageName.replaceAll('/', '\\/');
  const pathStyle = new RegExp(
    `(?:^|\\n)\\s*/${escapedName}@${escapeRegExp(version)}(?:[:(]|\\s|$)`,
    'm',
  );
  if (pathStyle.test(lockfileContent)) {
    return true;
  }

  // Importer snapshots sometimes list as `packageName: version` under dependencies
  // — too ambiguous alone; require the @version package key forms above.
  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Exclude entry in pnpm's minimumReleaseAgeExclude format (`name@version`).
 * Scoped packages must not introduce extra `@` in the version segment (pnpm rule).
 */
export function toMinimumReleaseAgeExcludeEntry(
  packageName: string,
  version: string,
): string {
  return `${packageName}@${version}`;
}

/**
 * Whether Renovate should retry lockfile generation with a maturity exclude for
 * this package@version.
 *
 * Allow when:
 * - version was already in the pre-update lockfile (main already accepted it), or
 * - any upgrade in this run is a vulnerability alert for that package targeting
 *   this version (security remediations are allowed to bypass age; artifacts may
 *   also write workspace excludes, but install can still race/fail first).
 */
export function shouldExcludeImmatureVersionForLockfileRetry(opts: {
  packageName: string;
  version: string;
  preUpdateLockfileContent: string | null | undefined;
  upgrades: Upgrade[];
}): boolean {
  const { packageName, version, preUpdateLockfileContent, upgrades } = opts;

  if (
    lockfileContainsPackageVersion(
      preUpdateLockfileContent,
      packageName,
      version,
    )
  ) {
    return true;
  }

  for (const upgrade of upgrades) {
    if (!upgrade.isVulnerabilityAlert) {
      continue;
    }
    const upgradeName = upgrade.packageName ?? upgrade.depName;
    if (!isString(upgradeName) || upgradeName !== packageName) {
      continue;
    }
    const target = upgrade.newVersion ?? upgrade.newValue;
    if (isString(target) && target === version) {
      return true;
    }
  }

  return false;
}

/**
 * Append pnpm CLI config flags so listed package@versions bypass minimumReleaseAge
 * for this install only (does not mutate pnpm-workspace.yaml).
 *
 * Uses repeated `--config.minimumReleaseAgeExclude[]=` entries (pnpm config arrays).
 */
export function appendPnpmMinimumReleaseAgeExcludeFlags(
  command: string,
  excludes: readonly string[],
): string {
  if (!excludes.length) {
    return command;
  }
  const flags = excludes
    .map((entry) => `--config.minimumReleaseAgeExclude[]=${quote(entry)}`)
    .join(' ');
  return `${command} ${flags}`;
}

/**
 * Map commands through appendPnpmMinimumReleaseAgeExcludeFlags.
 */
export function withPnpmMaturityExcludes(
  commands: string[],
  excludes: readonly string[],
): string[] {
  if (!excludes.length) {
    return commands;
  }
  return commands.map((cmd) =>
    appendPnpmMinimumReleaseAgeExcludeFlags(cmd, excludes),
  );
}

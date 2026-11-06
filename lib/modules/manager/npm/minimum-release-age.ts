import { isTruthy } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import {
  calculateMinimumReleaseAgeMs,
  calculatePackageManagerMinimumReleaseAgeMs,
} from '../../../util/minimum-release-age.ts';
import { coerceObject } from '../../../util/object.ts';
import { intersectsWith, isSubsetOf } from '../../versioning/common.ts';
import { api as npmVersioning } from '../../versioning/npm/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { resolveToolConstraint } from '../util.ts';
import { DAY_MS, MINUTE_MS } from './constants.ts';
import { isNpmrcOfLockFile, parseNpmrcCooldown } from './extract/npmrc.ts';
import { getPnpmMinimumReleaseAgeMinutes } from './extract/pnpm-minimum-release-age.ts';
import {
  getYarnMinimalAgeGateMinutes,
  getYarnScopeMinimalAgeGateMinutes,
  yarnDefaultMinimalAgeGateRange,
  yarnScopeMinimalAgeGateRange,
} from './extract/yarn-minimum-release-age.ts';
import type { NpmManagerData } from './types.ts';

// npm supports `min-release-age` since v11.10.0
// https://github.com/npm/cli/releases/tag/v11.10.0
export const minReleaseAgeNpmRange = '>=11.10.0';

// pnpm supports `minimumReleaseAge` since v10.16.0
// https://github.com/pnpm/pnpm/releases/tag/v10.16.0
export const minimumReleaseAgePnpmRange = '>=10.16.0';

// pnpm v10.16.0 skips the check for an exact version from the metadata cache,
// fixed in v10.17.0: https://github.com/pnpm/pnpm/releases/tag/v10.17.0
// pnpm v11.0.0 to v11.0.3 fall back to a version which is too new, unless
// `minimumReleaseAgeStrict` is set. Since v11.0.4, an explicit
// `minimumReleaseAge` turns on `minimumReleaseAgeStrict`.
// https://github.com/pnpm/pnpm/releases/tag/v11.0.4
// pnpm v12.0.0 to v12.2.x treat an explicit `minimumReleaseAge` as not strict
// again, fixed in v12.3.0.
export const minimumReleaseAgeEnforcedPnpmRange =
  '>=10.17.0 <11.0.0 || >=11.0.4 <12.0.0 || >=12.3.0';

// Yarn supports `npmMinimalAgeGate` and `npmPreapprovedPackages` since v4.10.0
// https://github.com/yarnpkg/berry/releases/tag/%40yarnpkg%2Fcli%2F4.10.0
export const minimumReleaseAgeYarnRange = '>=4.10.0';

interface NpmEnforcesMinimumReleaseAgeConfig extends UpdateArtifactsConfig {
  managerData?: NpmManagerData;
  npmrc?: string;
  packageFile?: string;
}

/**
 * The minimum release age which Renovate passes to npm or pnpm for the update in `config`.
 */
function getPassedMinimumReleaseAgeMs(
  config: NpmEnforcesMinimumReleaseAgeConfig,
  lockFile: string,
): number {
  return (
    calculatePackageManagerMinimumReleaseAgeMs({
      config,
      manager: 'npm',
      packageFile: upath.join(upath.dirname(lockFile), 'package.json'),
      upgrades: [config],
    }) ?? 0
  );
}

async function npmEnforcesMinimumReleaseAge(
  config: NpmEnforcesMinimumReleaseAgeConfig,
  npmLock: string,
): Promise<boolean> {
  // the lock file generation ignores an `.npmrc` of a parent directory
  const npmrcCooldown = isNpmrcOfLockFile(config)
    ? parseNpmrcCooldown(config.npmrc)
    : null;
  // the value which Renovate passes as `--before` to npm
  const minimumReleaseAgeMs = getPassedMinimumReleaseAgeMs(config, npmLock);

  if (npmrcCooldown?.source !== 'min-release-age') {
    // npm applies a `before` from the `.npmrc` itself, and Renovate passes
    // `--before` for `minimumReleaseAge`, which every npm version supports
    return npmrcCooldown?.source === 'before' || minimumReleaseAgeMs > 0;
  }

  // Renovate does not pass `--before` next to a `min-release-age`, so npm
  // only enforces the `min-release-age`
  if (minimumReleaseAgeMs > npmrcCooldown.days * DAY_MS) {
    logger.debug(
      `${npmLock}: min-release-age in .npmrc is shorter than minimumReleaseAge`,
    );
    return false;
  }

  // the status checks run before the base branch is checked out, so the
  // constraint is not derived from the package.json in the working tree
  const constraint = await resolveToolConstraint(config, 'npm');
  return isSubsetOf(npmVersioning, constraint, minReleaseAgeNpmRange);
}

async function pnpmEnforcesMinimumReleaseAge(
  config: NpmEnforcesMinimumReleaseAgeConfig,
  pnpmLockFile: string,
): Promise<boolean> {
  // the status checks run before the base branch is checked out, so the pnpm
  // constraint and settings of the lock file come from the extraction, which
  // copies them to every package file of the lock file
  const settings = coerceObject(config.managerData?.pnpmMinimumReleaseAge);
  const constraint = await resolveToolConstraint(
    config,
    'pnpm',
    () => settings.pnpmConstraint,
  );
  if (
    !isSubsetOf(npmVersioning, constraint, minimumReleaseAgeEnforcedPnpmRange)
  ) {
    return false;
  }

  if (settings.minimumReleaseAgeStrict === false) {
    logger.debug(
      `${pnpmLockFile}: minimumReleaseAgeStrict=false lets pnpm install versions which are too new`,
    );
    return false;
  }
  if (settings.hasMinimumReleaseAgeExclude) {
    logger.debug(
      `${pnpmLockFile}: minimumReleaseAgeExclude lets pnpm install versions which are too new`,
    );
    return false;
  }

  // Renovate passes the larger of its own value and the pnpm value,
  // otherwise pnpm applies its own value. The pnpm v11 default does not
  // count, as pnpm does not apply it strictly.
  const pnpmMinutes =
    getPnpmMinimumReleaseAgeMinutes(
      settings,
      settings.npmrcMinimumReleaseAge,
      constraint,
    ) ?? 0;
  return (
    Math.max(
      getPassedMinimumReleaseAgeMs(config, pnpmLockFile),
      pnpmMinutes * MINUTE_MS,
    ) > 0
  );
}

async function yarnEnforcesMinimumReleaseAge(
  config: NpmEnforcesMinimumReleaseAgeConfig,
  yarnLock: string,
): Promise<boolean> {
  const constraint = await resolveToolConstraint(config, 'yarn');
  if (!isSubsetOf(npmVersioning, constraint, minimumReleaseAgeYarnRange)) {
    return false;
  }

  // the status checks run before the base branch is checked out, so the
  // .yarnrc.yml settings come from the extraction
  const settings = coerceObject(config.managerData?.yarnMinimalAgeGate);
  // the age which Renovate would wait for, `minimumReleaseAgePackageManager`
  // only raises what it passes
  const lockFileMaintenanceAgeMs = calculateMinimumReleaseAgeMs({
    minimumReleaseAge: config.minimumReleaseAge,
  });
  // a scope without its own age may get the Yarn default
  const scopeMinutes = getYarnScopeMinimalAgeGateMinutes(
    settings,
    intersectsWith(npmVersioning, constraint, yarnScopeMinimalAgeGateRange),
  );
  for (const [scope, minutes] of Object.entries(scopeMinutes)) {
    if (!minutes || minutes * MINUTE_MS < lockFileMaintenanceAgeMs) {
      logger.debug(
        `${yarnLock}: the npmMinimalAgeGate of scope ${scope} is 0 or smaller than the minimumReleaseAge of lock file maintenance, and takes precedence over the age which Renovate passes`,
      );
      return false;
    }
  }

  // Renovate passes the larger of its own value and the Yarn value, otherwise
  // Yarn applies its own value. The Yarn default counts only if every allowed
  // Yarn version has it.
  const yarnMinutes =
    getYarnMinimalAgeGateMinutes(
      settings,
      isSubsetOf(npmVersioning, constraint, yarnDefaultMinimalAgeGateRange),
    ) ?? 0;
  return (
    Math.max(
      getPassedMinimumReleaseAgeMs(config, yarnLock),
      yarnMinutes * MINUTE_MS,
    ) > 0
  );
}

/**
 * Whether npm, pnpm or Yarn enforces the minimum release age when it regenerates the lock file of the package file in `config`, or the package file has no lock file which lock file maintenance could update.
 */
export async function enforcesMinimumReleaseAge(
  config: NpmEnforcesMinimumReleaseAgeConfig,
): Promise<boolean> {
  const { npmLock, pnpmLockFile, yarnLock } = coerceObject(config.managerData);
  const lockFiles = [npmLock, pnpmLockFile, yarnLock].filter(isTruthy);
  if (!lockFiles.length) {
    logger.debug(
      `${config.packageFile}: no lock file, so lock file maintenance changes nothing`,
    );
    return true;
  }
  if (lockFiles.length > 1) {
    return false;
  }
  if (yarnLock) {
    return await yarnEnforcesMinimumReleaseAge(config, yarnLock);
  }
  if (npmLock) {
    return await npmEnforcesMinimumReleaseAge(config, npmLock);
  }
  return await pnpmEnforcesMinimumReleaseAge(config, pnpmLockFile!);
}

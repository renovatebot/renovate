import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { calculatePackageManagerMinimumReleaseAgeMs } from '../../../util/minimum-release-age.ts';
import { coerceObject } from '../../../util/object.ts';
import { isSubsetOf } from '../../versioning/common.ts';
import { api as npmVersioning } from '../../versioning/npm/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { resolveToolConstraint } from '../util.ts';
import { DAY_MS, MINUTE_MS } from './constants.ts';
import { isNpmrcOfLockFile, parseNpmrcCooldown } from './extract/npmrc.ts';
import { getPnpmMinimumReleaseAgeMinutes } from './extract/pnpm-minimum-release-age.ts';
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

/**
 * Whether npm or pnpm enforces the minimum release age when it regenerates the lock file of the package file in `config`, or the package file has no lock file which lock file maintenance could update.
 */
export async function enforcesMinimumReleaseAge(
  config: NpmEnforcesMinimumReleaseAgeConfig,
): Promise<boolean> {
  const { npmLock, pnpmLockFile, yarnLock } = coerceObject(config.managerData);
  if (!npmLock && !pnpmLockFile && !yarnLock) {
    logger.debug(
      `${config.packageFile}: no lock file, so lock file maintenance changes nothing`,
    );
    return true;
  }
  const hasBothLockFiles = !!npmLock && !!pnpmLockFile;
  if (yarnLock || hasBothLockFiles) {
    return false;
  }
  if (npmLock) {
    return await npmEnforcesMinimumReleaseAge(config, npmLock);
  }
  return await pnpmEnforcesMinimumReleaseAge(config, pnpmLockFile!);
}

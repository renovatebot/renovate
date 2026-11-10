import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { calculatePackageManagerMinimumReleaseAgeMs } from '../../../util/minimum-release-age.ts';
import { isSubsetOf } from '../../versioning/common.ts';
import { api as npmVersioning } from '../../versioning/npm/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { resolveToolConstraint } from '../util.ts';
import { parseNpmrcCooldown } from './extract/npmrc.ts';
import type { NpmManagerData } from './types.ts';

// npm supports `min-release-age` since v11.10.0
// https://github.com/npm/cli/releases/tag/v11.10.0
export const minReleaseAgeNpmRange = '>=11.10.0';

const dayMs = 24 * 60 * 60 * 1000;

interface NpmEnforcesMinimumReleaseAgeConfig extends UpdateArtifactsConfig {
  managerData?: NpmManagerData;
  npmrc?: string;
}

/**
 * Whether npm enforces the minimum release age when it regenerates the lock file of the package file in `config`.
 */
export async function enforcesMinimumReleaseAge(
  config: NpmEnforcesMinimumReleaseAgeConfig,
): Promise<boolean> {
  const { managerData } = config;
  const npmLock = managerData?.npmLock;
  if (!npmLock || managerData.yarnLock || managerData.pnpmLockFile) {
    return false;
  }

  const npmrcCooldown = parseNpmrcCooldown(config.npmrc);
  // the value which Renovate passes as `--before` to npm
  const minimumReleaseAgeMs =
    calculatePackageManagerMinimumReleaseAgeMs({
      config,
      manager: 'npm',
      packageFile: upath.join(upath.dirname(npmLock), 'package.json'),
      upgrades: [config],
    }) ?? 0;

  if (npmrcCooldown?.source !== 'min-release-age') {
    // npm applies a `before` from the `.npmrc` itself, and Renovate passes
    // `--before` for `minimumReleaseAge`, which every npm version supports
    return npmrcCooldown?.source === 'before' || minimumReleaseAgeMs > 0;
  }

  // Renovate does not pass `--before` next to a `min-release-age`, so npm
  // only enforces the `min-release-age`
  if (minimumReleaseAgeMs > npmrcCooldown.days * dayMs) {
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

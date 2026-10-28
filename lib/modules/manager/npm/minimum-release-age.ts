import { isNonEmptyString } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { toMs } from '../../../util/pretty-time.ts';
import { api as npmVersioning } from '../../versioning/npm/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { resolveToolConstraint } from '../util.ts';
import { parseNpmrcCooldown } from './extract/npmrc.ts';
import { getPackageManagerVersion } from './post-update/utils.ts';
import type { NpmManagerData } from './types.ts';
import { loadPackageJson } from './utils.ts';

// npm supports `min-release-age` since v11.10.0
// https://github.com/npm/cli/releases/tag/v11.10.0
export const minReleaseAgeNpmRange = '>=11.10.0';

const dayMs = 24 * 60 * 60 * 1000;

interface NpmEnforcesMinimumReleaseAgeConfig extends UpdateArtifactsConfig {
  managerData?: NpmManagerData;
  npmrc?: string;
}

function getMinimumReleaseAgeMs(
  minimumReleaseAge: string | null | undefined,
): number | null {
  return isNonEmptyString(minimumReleaseAge) ? toMs(minimumReleaseAge) : null;
}

async function isNpmMinReleaseAgeSupported(
  config: NpmEnforcesMinimumReleaseAgeConfig,
  npmLock: string,
): Promise<boolean> {
  const constraint = await resolveToolConstraint(config, 'npm', async () =>
    getPackageManagerVersion(
      'npm',
      await loadPackageJson(upath.dirname(npmLock)),
    ),
  );
  return (
    isNonEmptyString(constraint) &&
    npmVersioning.isValid(constraint) &&
    npmVersioning.subset?.(constraint, minReleaseAgeNpmRange) === true
  );
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
  const minimumReleaseAgeMs = getMinimumReleaseAgeMs(config.minimumReleaseAge);

  if (npmrcCooldown?.source !== 'min-release-age') {
    // npm applies a `before` from the `.npmrc` itself, and Renovate passes
    // `--before` for `minimumReleaseAge`, which every npm version supports
    return npmrcCooldown?.source === 'before' || minimumReleaseAgeMs !== null;
  }

  // Renovate does not pass `--before` next to a `min-release-age`, so npm
  // only enforces the `min-release-age`
  if ((minimumReleaseAgeMs ?? 0) > npmrcCooldown.days * dayMs) {
    logger.debug(
      `${npmLock}: min-release-age in .npmrc is shorter than minimumReleaseAge`,
    );
    return false;
  }

  return await isNpmMinReleaseAgeSupported(config, npmLock);
}

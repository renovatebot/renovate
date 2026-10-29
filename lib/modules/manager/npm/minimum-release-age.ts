import { isNonEmptyString } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { toMs } from '../../../util/pretty-time.ts';
import { api as npmVersioning } from '../../versioning/npm/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { resolveToolConstraint } from '../util.ts';
import { parseNpmrcCooldown } from './extract/npmrc.ts';
import {
  getPnpmMinimumReleaseAgeMinutes,
  readPnpmWorkspaceMinimumReleaseAge,
} from './extract/pnpm-minimum-release-age.ts';
import { getPackageManagerVersion } from './post-update/utils.ts';
import type { NpmManagerData } from './types.ts';
import { loadPackageJson } from './utils.ts';

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
export const minimumReleaseAgeEnforcedPnpmRange =
  '>=10.17.0 <11.0.0 || >=11.0.4';

const dayMs = 24 * 60 * 60 * 1000;
const minuteMs = 60 * 1000;

interface NpmEnforcesMinimumReleaseAgeConfig extends UpdateArtifactsConfig {
  managerData?: NpmManagerData;
  npmrc?: string;
}

function getMinimumReleaseAgeMs(
  minimumReleaseAge: string | null | undefined,
): number | null {
  return isNonEmptyString(minimumReleaseAge) ? toMs(minimumReleaseAge) : null;
}

async function resolveConstraint(
  config: NpmEnforcesMinimumReleaseAgeConfig,
  toolName: 'npm' | 'pnpm',
  lockFile: string,
): Promise<string | undefined> {
  return await resolveToolConstraint(config, toolName, async () =>
    getPackageManagerVersion(
      toolName,
      await loadPackageJson(upath.dirname(lockFile)),
    ),
  );
}

function isInRange(constraint: string | undefined, range: string): boolean {
  return (
    isNonEmptyString(constraint) &&
    npmVersioning.isValid(constraint) &&
    npmVersioning.subset?.(constraint, range) === true
  );
}

async function npmEnforcesMinimumReleaseAge(
  config: NpmEnforcesMinimumReleaseAgeConfig,
  npmLock: string,
): Promise<boolean> {
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

  return isInRange(
    await resolveConstraint(config, 'npm', npmLock),
    minReleaseAgeNpmRange,
  );
}

async function pnpmEnforcesMinimumReleaseAge(
  config: NpmEnforcesMinimumReleaseAgeConfig,
  pnpmLockFile: string,
): Promise<boolean> {
  const constraint = await resolveConstraint(config, 'pnpm', pnpmLockFile);
  if (!isInRange(constraint, minimumReleaseAgeEnforcedPnpmRange)) {
    return false;
  }

  const workspace = await readPnpmWorkspaceMinimumReleaseAge(pnpmLockFile);
  if (workspace.minimumReleaseAgeStrict === false) {
    logger.debug(
      `${pnpmLockFile}: minimumReleaseAgeStrict=false lets pnpm install versions which are too new`,
    );
    return false;
  }

  // Renovate passes the larger of `minimumReleaseAge` and the pnpm value,
  // otherwise pnpm applies its own value. The pnpm v11 default does not
  // count, as pnpm does not apply it strictly.
  const pnpmMinutes =
    getPnpmMinimumReleaseAgeMinutes(workspace, config.npmrc, constraint) ?? 0;
  return (
    Math.max(
      getMinimumReleaseAgeMs(config.minimumReleaseAge) ?? 0,
      pnpmMinutes * minuteMs,
    ) > 0
  );
}

/**
 * Whether npm or pnpm enforces the minimum release age when it regenerates the lock file of the package file in `config`.
 */
export async function enforcesMinimumReleaseAge(
  config: NpmEnforcesMinimumReleaseAgeConfig,
): Promise<boolean> {
  const { npmLock, pnpmLockFile, yarnLock } = coerceObject(config.managerData);
  if (yarnLock || (npmLock && pnpmLockFile)) {
    return false;
  }
  if (npmLock) {
    return await npmEnforcesMinimumReleaseAge(config, npmLock);
  }
  if (pnpmLockFile) {
    return await pnpmEnforcesMinimumReleaseAge(config, pnpmLockFile);
  }
  return false;
}

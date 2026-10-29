import { isNonEmptyString } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { readLocalFile } from '../../../../util/fs/index.ts';
import { api as npmVersioning } from '../../../versioning/npm/index.ts';
import type { PackageFile } from '../../types.ts';
import { PnpmWorkspaceMinimumReleaseAge } from '../schema.ts';
import type { NpmManagerData } from '../types.ts';
import { parseNpmrcPnpmMinimumReleaseAge } from './npmrc.ts';

// pnpm reads only auth and registry settings from `.npmrc` since v11.0.0
// https://github.com/pnpm/pnpm/releases/tag/v11.0.0
export const pnpmNpmrcMinimumReleaseAgeRange = '<11.0.0';

// pnpm defaults `minimumReleaseAge` to 1 day since v11.0.0
// https://github.com/pnpm/pnpm/releases/tag/v11.0.0
export const pnpmDefaultMinimumReleaseAgeRange = '>=11.0.0';
export const pnpmDefaultMinimumReleaseAgeMinutes = 1440;

/**
 * Reads the minimum release age settings of the `pnpm-workspace.yaml` next to a pnpm lock file.
 *
 * pnpm sets `minimumReleaseAge` in minutes.
 */
export async function readPnpmWorkspaceMinimumReleaseAge(
  pnpmLockFile: string,
): Promise<PnpmWorkspaceMinimumReleaseAge> {
  const workspaceFile = upath.join(
    upath.dirname(pnpmLockFile),
    'pnpm-workspace.yaml',
  );
  const content = await readLocalFile(workspaceFile, 'utf8');
  if (!content) {
    return {};
  }
  const parsed = PnpmWorkspaceMinimumReleaseAge.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { workspaceFile, err: parsed.error },
      'Failed to parse the minimum release age of pnpm-workspace.yaml',
    );
    return {};
  }
  return parsed.data;
}

/**
 * The `minimumReleaseAge` in minutes which pnpm configures itself.
 *
 * The `pnpm-workspace.yaml` wins over the `.npmrc`, which pnpm reads only before v11.
 * With `includeDefault`, the pnpm default applies if neither sets it and the pnpm version may be v11 or later.
 * An unknown pnpm version counts as the latest pnpm.
 */
export function getPnpmMinimumReleaseAgeMinutes(
  workspace: PnpmWorkspaceMinimumReleaseAge,
  npmrcContent: string | null | undefined,
  pnpmConstraint: string | null | undefined,
  includeDefault = false,
): number | undefined {
  if (workspace.minimumReleaseAge !== undefined) {
    return workspace.minimumReleaseAge;
  }
  const constraint =
    isNonEmptyString(pnpmConstraint) && npmVersioning.isValid(pnpmConstraint)
      ? pnpmConstraint
      : null;
  const npmrcMinutes =
    constraint &&
    npmVersioning.subset?.(constraint, pnpmNpmrcMinimumReleaseAgeRange) === true
      ? parseNpmrcPnpmMinimumReleaseAge(npmrcContent)
      : undefined;
  if (npmrcMinutes !== undefined) {
    return npmrcMinutes;
  }
  if (
    includeDefault &&
    (!constraint ||
      npmVersioning.intersects?.(
        constraint,
        pnpmDefaultMinimumReleaseAgeRange,
      ) === true)
  ) {
    return pnpmDefaultMinimumReleaseAgeMinutes;
  }
  return undefined;
}

/**
 * Sets `minimumReleaseAgeExtracted` on the package files which are managed by pnpm, from the `pnpm-workspace.yaml` `minimumReleaseAge` or, before pnpm v11, the repository `.npmrc` `minimum-release-age`.
 */
export async function setPnpmMinimumReleaseAge(
  packageFiles: Partial<PackageFile<NpmManagerData>>[],
): Promise<void> {
  const workspaces = new Map<string, PnpmWorkspaceMinimumReleaseAge>();
  for (const packageFile of packageFiles) {
    const { managerData } = packageFile;
    const pnpmLockFile = managerData?.pnpmLockFile;
    if (!pnpmLockFile) {
      continue;
    }
    let workspace = workspaces.get(pnpmLockFile);
    if (!workspace) {
      workspace = await readPnpmWorkspaceMinimumReleaseAge(pnpmLockFile);
      workspaces.set(pnpmLockFile, workspace);
    }
    const minutes = getPnpmMinimumReleaseAgeMinutes(
      workspace,
      managerData.repoNpmrc?.content,
      packageFile.extractedConstraints?.pnpm,
    );
    if (minutes) {
      logger.debug(
        `Found pnpm minimum release age of ${minutes} minutes for ${packageFile.packageFile}`,
      );
      packageFile.minimumReleaseAgeExtracted = `${minutes} minutes`;
    }
  }
}

import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { readLocalFile } from '../../../../util/fs/index.ts';
import type { PackageFile } from '../../types.ts';
import { PnpmWorkspaceMinimumReleaseAge } from '../schema.ts';
import type { NpmManagerData } from '../types.ts';

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
 * Sets `minimumReleaseAgeExtracted` from the `pnpm-workspace.yaml` `minimumReleaseAge` on the package files which are managed by pnpm.
 */
export async function setPnpmMinimumReleaseAge(
  packageFiles: Partial<PackageFile<NpmManagerData>>[],
): Promise<void> {
  const minutesByLockFile = new Map<string, number | undefined>();
  for (const packageFile of packageFiles) {
    const pnpmLockFile = packageFile.managerData?.pnpmLockFile;
    if (!pnpmLockFile) {
      continue;
    }
    if (!minutesByLockFile.has(pnpmLockFile)) {
      const { minimumReleaseAge } =
        await readPnpmWorkspaceMinimumReleaseAge(pnpmLockFile);
      minutesByLockFile.set(pnpmLockFile, minimumReleaseAge);
    }
    const minutes = minutesByLockFile.get(pnpmLockFile);
    if (minutes) {
      logger.debug(
        `Found minimum release age of ${minutes} minutes in pnpm-workspace.yaml for ${packageFile.packageFile}`,
      );
      packageFile.minimumReleaseAgeExtracted = `${minutes} minutes`;
    }
  }
}

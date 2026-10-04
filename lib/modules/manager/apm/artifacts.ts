import { isNonEmptyArray } from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { collectFileChanges } from '../../../util/git/file-changes.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import {
  artifactErrorResult,
  fileChangesToArtifactResults,
  resolveToolConstraint,
} from '../util.ts';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`apm.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (!isNonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('apm: no updated deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'apm.lock.yaml');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('apm: no lock file found');
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {},
      toolConstraints: [
        {
          toolName: 'apm',
          constraint: await resolveToolConstraint(config, 'apm'),
        },
      ],
    };
    // Lock file maintenance runs `apm update`, which re-resolves each
    // dependency to the latest ref its spec allows and leaves `apm.yml`
    // untouched (`--yes` skips its prompt). `apm install` can't do this: it only
    // syncs the lockfile to the manifest.
    //
    // The lockfile stays in place. It is APM's record of which deployed files
    // it owns, so without it `apm install` skips the committed files as
    // unmanaged: the ownership ledger and file hashes are lost, and when a ref
    // moves, the deployed files stay at the old version.
    await exec(
      isLockFileMaintenance ? 'apm update --yes' : 'apm install',
      execOptions,
    );

    // The command regenerates the lockfile and re-deploys the harness
    // directories (`.github/`, `.claude/`, ...) that APM consumers commit, so
    // return every file it changed - not just the lockfile - or the committed
    // instruction files go stale after a bump. `apm_modules/` is the gitignored
    // cache, so it is not reported here.
    const status = await getRepoStatus();
    const res = fileChangesToArtifactResults([
      ...(await collectFileChanges(status, {
        include: ['modified', 'not_added'],
        // the manifest itself is committed as an updated package file
        filter: (path) => path !== packageFileName,
      })),
      ...(await collectFileChanges(status, { include: ['deleted'] })),
    ]);
    if (!res.length) {
      logger.debug('apm: no changed files after install');
      return null;
    }
    return res;
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, `Failed to update ${lockFileName}`);
    return artifactErrorResult(lockFileName, err);
  }
}

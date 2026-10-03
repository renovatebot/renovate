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
    // `apm install` only resolves the refs `apm.yml` already pins, so it is a
    // no-op on an up-to-date project. `apm update` re-resolves each dependency
    // to the latest matching ref and leaves `apm.yml` untouched, which is what
    // lock file maintenance means; `--yes` skips its confirmation prompt.
    //
    // The lockfile is no longer removed first. `apm.lock.yaml` records which
    // harness files APM owns and their integrity hashes, and `apm install`
    // cannot rebuild those rows when the files are already on disk - it deploys
    // nothing, so it records no ownership. Deleting the lockfile therefore
    // discards the `deployments` ledger and every `deployed_file_hashes` entry,
    // which `apm audit` then reports as unrecorded files.
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

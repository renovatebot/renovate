import { isEmptyArray } from '@sindresorhus/is';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { processHostRules } from '../npm/post-update/rules.ts';
import { withNpmrcHostRules } from '../npm/utils.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import {
  artifactErrorResult,
  resolveToolConstraint,
  updateLockFile,
} from '../util.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`aube.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (isEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated aube deps - returning null');
    return null;
  }

  // Find the first aube dependency in order to handle mixed manager updates,
  // eventually falling back to the first lock file from config.
  const lockFileName =
    updatedDeps.find((dep) => dep.manager === 'aube')?.lockFiles?.[0] ??
    config.lockFiles?.[0];

  if (!lockFileName) {
    logger.debug(`aube: No lock file found`);
    return null;
  }

  const oldLockFileContent = await readLocalFile(lockFileName);
  if (!oldLockFileContent) {
    logger.debug(`No ${lockFileName} found`);
    return null;
  }

  const pkgFileDir = upath.dirname(packageFileName);
  const { additionalNpmrcContent } = processHostRules();

  try {
    return await withNpmrcHostRules(
      pkgFileDir,
      additionalNpmrcContent,
      async () => {
        // aube defaults to `--frozen-lockfile` under the `CI=true` that Renovate sets for child processes
        let cmd = 'aube install --lockfile-only --prefer-frozen-lockfile';

        if (!GlobalConfig.get('allowScripts') || config.ignoreScripts) {
          cmd += ' --ignore-scripts';
        }

        const execOptions: ExecOptions = {
          cwdFile: lockFileName,
          docker: {},
          toolConstraints: [
            {
              toolName: 'aube',
              constraint: await resolveToolConstraint(config, 'aube'),
            },
          ],
        };

        return await updateLockFile({
          lockFileName,
          existingLockFileContent: oldLockFileContent,
          packageFile: {
            path: packageFileName,
            contents: newPackageFileContent,
          },
          deleteLockFile: isLockFileMaintenance,
          run: () => exec(cmd, execOptions),
        });
      },
    );
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn({ lockfile: lockFileName, err }, `Failed to update lock file`);
    return artifactErrorResult(lockFileName, err);
  }
}

import { isEmptyArray } from '@sindresorhus/is';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  deleteLocalFile,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { processHostRules } from '../npm/post-update/rules.ts';
import {
  getNpmrcContent,
  resetNpmrcContent,
  updateNpmrcContent,
} from '../npm/utils.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`bun.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (isEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated bun deps - returning null');
    return null;
  }

  // Find the first bun dependency in order to handle mixed manager updates,
  // eventually falling back to the first lock file from config.
  const lockFileName =
    updatedDeps.find((dep) => dep.manager === 'bun')?.lockFiles?.[0] ??
    config.lockFiles?.[0];

  if (!lockFileName) {
    logger.debug(`bun: No lock file found`);
    return null;
  }

  const oldLockFileContent = await readLocalFile(lockFileName);
  if (!oldLockFileContent) {
    logger.debug(`No ${lockFileName} found`);
    return null;
  }

  const pkgFileDir = upath.dirname(packageFileName);
  const npmrcContent = await getNpmrcContent(pkgFileDir);
  const { additionalNpmrcContent } = processHostRules();
  await updateNpmrcContent(pkgFileDir, npmrcContent, additionalNpmrcContent);

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }

    let cmd = 'bun install';

    if (!GlobalConfig.get('allowScripts') || config.ignoreScripts) {
      cmd += ' --ignore-scripts';
    }

    const execOptions: ExecOptions = {
      cwdFile: lockFileName,
      docker: {},
      toolConstraints: [
        {
          toolName: 'bun',
          constraint: updateArtifact?.config?.constraints?.bun,
        },
      ],
    };

    await exec(cmd, execOptions);
    await resetNpmrcContent(pkgFileDir, npmrcContent);

    const newLockFileContent = await readLocalFile(lockFileName);
    if (
      !newLockFileContent ||
      Buffer.compare(oldLockFileContent, newLockFileContent) === 0
    ) {
      return null;
    }
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        },
      },
    ];
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn({ lockfile: lockFileName, err }, `Failed to update lock file`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}

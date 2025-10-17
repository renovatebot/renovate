import is from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile, writeLocalFile } from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import type { DenoManagerData } from './types';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact<DenoManagerData>,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`deno.updateArtifacts(${packageFileName})`);
  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (is.emptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated deno deps - returning null');
    return null;
  }

  const lockFileName = updatedDeps[0].lockFiles?.[0];

  if (!lockFileName) {
    logger.debug('No lock file found. Skipping artifact update.');
    return null;
  }

  const oldLockFileContent = await readLocalFile(lockFileName);
  if (!oldLockFileContent) {
    logger.debug(`Failed to read ${lockFileName}. Skipping artifact update.`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: `Failed to read "${lockFileName}"`,
        },
      },
    ];
  }

  for (const updateDep of updatedDeps) {
    if (
      updateDep.depType === 'tasks' ||
      updateDep.depType === 'tasks.command'
    ) {
      logger.warn(
        `depType: "${updateDep.depType}", depName: "${updateDep.depName}" can't be updated with a lock file: "${lockFileName}"`,
      );
      return [
        {
          artifactError: {
            lockFile: lockFileName,
            stderr: `depType: "${updateDep.depType}", depName: "${updateDep.depName}" can't be updated with a lock file: "${lockFileName}"`,
          },
        },
      ];
    }
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    // run from its referred deno.json/deno.jsonc location if import map is used
    const importMapReferrerDep = updatedDeps.find(
      (dep) => dep.managerData?.importMapReferrer,
    );
    const cwdFile =
      importMapReferrerDep?.managerData?.importMapReferrer ?? packageFileName;

    const execOptions: ExecOptions = {
      cwdFile,
      docker: {},
      toolConstraints: [
        {
          toolName: 'deno',
          constraint: config.constraints?.deno,
        },
      ],
    };

    // "deno install" don't execute lifecycle scripts of package.json by default
    // https://docs.deno.com/runtime/reference/cli/install/#native-node.js-addons
    await exec('deno install', execOptions);

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

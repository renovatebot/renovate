import { isEmptyArray } from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  deleteLocalFile,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import type { DenoManagerData } from './types.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact<DenoManagerData>,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`deno.updateArtifacts(${packageFileName})`);
  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (isEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated deno deps - returning null');
    return null;
  }

  // handle the setting of frozen lock file gracefully
  // NOTE: Historical reasons, yarn seems to force an update of the lock file.
  // https://github.com/renovatebot/renovate/pull/9515
  // https://github.com/renovatebot/renovate/discussions/9481#discussioncomment-593028
  // but should respect the setting here
  const frozenLockfile = updatedDeps.find(
    (dep) => dep.managerData?.frozenLockfile,
  );
  if (frozenLockfile && !isLockFileMaintenance) {
    logger.debug('Lock file should be frozen. Skipping artifact update.');
    return null;
  }

  // falling back for lockFileMaintenance
  const lockFileName = updatedDeps[0]?.lockFiles?.[0] ?? config.lockFiles?.[0];

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
          fileName: lockFileName,
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
            fileName: lockFileName,
            stderr: `depType: "${updateDep.depType}", depName: "${updateDep.depName}" can't be updated with a lock file: "${lockFileName}"`,
          },
        },
      ];
    }
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }

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
    // TODO: appending `--lockfile-only` is better
    // https://docs.deno.com/runtime/reference/cli/install/#options-lockfile-only
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
          fileName: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}

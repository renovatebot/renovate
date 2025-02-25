import is from '@sindresorhus/is';
import { SemVer } from 'semver';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts(
  updateConfig: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = getSiblingFileName(
    updateConfig.packageFileName,
    'devbox.lock',
  );
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No devbox.lock found');
    return null;
  }

  const supportsNoInstall = updateConfig.config.constraints?.devbox
    ? new SemVer(updateConfig.config.constraints.devbox).compare('0.14.0') >= 0
    : true;

  const execOptions: ExecOptions = {
    cwdFile: updateConfig.packageFileName,
    toolConstraints: [
      {
        toolName: 'devbox',
        constraint: updateConfig.config.constraints?.devbox,
      },
    ],
    docker: {},
    userConfiguredEnv: updateConfig.config.env,
  };

  let cmd = '';
  if (
    updateConfig.config.isLockFileMaintenance ||
    updateConfig.config.updateType === 'lockFileMaintenance'
  ) {
    cmd += supportsNoInstall ? 'devbox update --no-install' : 'devbox update';
  } else if (is.nonEmptyArray(updateConfig.updatedDeps)) {
    if (supportsNoInstall) {
      const updateCommands = updateConfig.updatedDeps
        .map(
          (dep) => dep.depName && `devbox update ${dep.depName} --no-install`,
        )
        .filter((dep) => dep);
      if (updateCommands.length) {
        cmd += updateCommands.join('; ');
      } else {
        logger.trace('No updated devbox packages - returning null');
        return null;
      }
    } else {
      cmd += 'devbox install';
    }
  } else {
    logger.trace('No updated devbox packages - returning null');
    return null;
  }

  const oldLockFileContent = await readLocalFile(lockFileName);
  if (!oldLockFileContent) {
    logger.trace(`No ${lockFileName} found`);
    return null;
  }

  try {
    await exec(cmd, execOptions);
    const newLockFileContent = await readLocalFile(lockFileName);

    if (
      !newLockFileContent ||
      Buffer.compare(oldLockFileContent, newLockFileContent) === 0
    ) {
      return null;
    }
    logger.trace('Returning updated devbox.lock');
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
    logger.warn({ err }, 'Error updating devbox.lock');
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

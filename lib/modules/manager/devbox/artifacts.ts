import is from '@sindresorhus/is';
import { SemVer } from 'semver';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import { resolveConstraint } from '../../../util/exec/containerbase';
import type { ExecOptions } from '../../../util/exec/types';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts({
  config: { constraints, env, isLockFileMaintenance, updateType },
  packageFileName,
  updatedDeps,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = getSiblingFileName(packageFileName, 'devbox.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No devbox.lock found');
    return null;
  }

  let supportsNoInstall = true;
  if (constraints?.devbox) {
    const constraintVersion = await resolveConstraint({
      toolName: 'devbox',
      constraint: constraints?.devbox,
    });
    supportsNoInstall = new SemVer(constraintVersion).compare('0.14.0') >= 0;
  }

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    toolConstraints: [
      {
        toolName: 'devbox',
        constraint: constraints?.devbox,
      },
    ],
    docker: {},
    userConfiguredEnv: env,
  };

  let cmd = '';
  if (isLockFileMaintenance || updateType === 'lockFileMaintenance') {
    cmd += supportsNoInstall ? 'devbox update --no-install' : 'devbox update';
  } else if (is.nonEmptyArray(updatedDeps)) {
    if (supportsNoInstall) {
      const updateCommands = updatedDeps
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

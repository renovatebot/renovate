import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import type { PubspecLock, PubspecSdk } from './types';

export function getConstraint(
  lockFileContent: string,
  lockFileSdkKey: keyof PubspecSdk
): string | undefined {
  try {
    const data = load(lockFileContent, { json: true }) as PubspecLock;
    const constraint = data.sdks[lockFileSdkKey];
    if (is.string(constraint)) {
      return constraint;
    }
  } catch (err) {
    // Do nothing
  }
  return undefined;
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pub.updateArtifacts(${packageFileName})`);
  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (is.emptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated pub deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'pubspec.lock');
  const oldLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!oldLockFileContent) {
    logger.debug('No pubspec.lock found');
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const isFlutter = newPackageFileContent.includes('sdk: flutter');
    const toolName = isFlutter ? 'flutter' : 'dart';
    const cmd: string[] = [];

    if (isLockFileMaintenance) {
      cmd.push(`${toolName} pub upgrade`);
    } else {
      cmd.push(
        `${toolName} pub upgrade ${updatedDeps
          .map((dep) => dep.depName)
          .filter(is.string)
          .map((dep) => quote(dep))
          .join(' ')}`
      );
    }

    const constraint = isFlutter
      ? config.constraints?.flutter ??
        getConstraint(oldLockFileContent, 'flutter')
      : config.constraints?.dart ?? getConstraint(oldLockFileContent, 'dart');
    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {},
      toolConstraints: [
        {
          toolName,
          constraint,
        },
      ],
    };

    await exec(cmd, execOptions);
    const newLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (oldLockFileContent === newLockFileContent) {
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
    // istanbul ignore if
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

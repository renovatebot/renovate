import is from '@sindresorhus/is';
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
import { lazyParsePubspeckLock } from './utils';

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

    const oldLazyPubspecLock = lazyParsePubspeckLock(
      lockFileName,
      oldLockFileContent
    );
    const constraint = isFlutter
      ? config.constraints?.flutter ??
        oldLazyPubspecLock.getValue()?.sdks.flutter
      : config.constraints?.dart ?? oldLazyPubspecLock.getValue()?.sdks.dart;
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

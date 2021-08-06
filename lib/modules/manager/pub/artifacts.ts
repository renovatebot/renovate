import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

function getFlutterConstraint(lockFileContent: string): string | undefined {
  return regEx(/^\tflutter: ['"](?<flutterVersion>.*)['"]$/m).exec(
    lockFileContent
  )?.groups?.flutterVersion;
}

function getDartConstraint(lockFileContent: string): string | undefined {
  return regEx(/^\tdart: ['"](?<dartVersion>.*)['"]$/m).exec(lockFileContent)
    ?.groups?.dartVersion;
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (
    !(
      config.updateType === 'lockFileMaintenance' ||
      config.updateType === 'lockfileUpdate'
    ) &&
    updatedDeps.length < 1
  ) {
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'pubspec.lock');
  const oldLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!oldLockFileContent) {
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const isFlutter = newPackageFileContent.includes('sdk: flutter');
    const toolName = isFlutter ? 'flutter' : 'dart';

    const constraint = isFlutter
      ? config.constraints?.flutter ?? getFlutterConstraint(oldLockFileContent)
      : config.constraints?.dart ?? getDartConstraint(oldLockFileContent);
    await exec(`${toolName} pub upgrade`, {
      cwdFile: packageFileName,
      docker: {
        image: 'sidecar',
      },
      toolConstraints: [
        {
          toolName,
          constraint,
        },
      ],
    });

    const newLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (
      oldLockFileContent === newLockFileContent ||
      newLockFileContent === undefined
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
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn({ err }, `Failed to update ${lockFileName} file`);
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

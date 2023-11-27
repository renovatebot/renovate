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
import type { UpdateArtifact, UpdateArtifactsResult, Upgrade } from '../types';
import { parsePubspecLock } from './utils';

const SDK_NAMES = ['dart', 'flutter'];
const PUB_GET_COMMAND = 'pub get --no-precompile';

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
    const cmd = getExecCommand(toolName, updatedDeps, isLockFileMaintenance);

    let constraint = config.constraints?.[toolName];
    if (!constraint) {
      const pubspecLock = parsePubspecLock(lockFileName, oldLockFileContent);
      constraint = pubspecLock?.sdks[toolName];
    }

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

function getExecCommand(
  toolName: string,
  updatedDeps: Upgrade<Record<string, unknown>>[],
  isLockFileMaintenance: boolean,
): string {
  if (isLockFileMaintenance) {
    return `${toolName} pub upgrade`;
  } else {
    const depNames = updatedDeps.map((dep) => dep.depName).filter(is.string);
    if (depNames.length === 1 && SDK_NAMES.includes(depNames[0])) {
      return `${toolName} ${PUB_GET_COMMAND}`;
    }
    // If there are two updated dependencies and both of them are SDK updates (Dart and Flutter),
    // we use Flutter over Dart to run `pub get` as it is a Flutter project.
    else if (
      depNames.length === 2 &&
      depNames.filter((depName) => SDK_NAMES.includes(depName)).length === 2
    ) {
      return `flutter ${PUB_GET_COMMAND}`;
    } else {
      const depNamesCmd = depNames
        .filter((depName) => !SDK_NAMES.includes(depName))
        .map(quote)
        .join(' ');
      return `${toolName} pub upgrade ${depNamesCmd}`;
    }
  }
}

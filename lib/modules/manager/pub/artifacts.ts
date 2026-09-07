import { isEmptyArray, isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import type {
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../types.ts';
import { artifactErrorResult, updateLockFile } from '../util.ts';
import { parsePubspec, parsePubspecLock } from './utils.ts';

const SDK_NAMES = ['dart', 'flutter'];
const PUB_GET_COMMAND = 'pub get --no-precompile';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pub.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (isEmptyArray(updatedDeps) && !isLockFileMaintenance) {
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
    const isFlutter = newPackageFileContent.includes('sdk: flutter');
    const toolName = isFlutter ? 'flutter' : 'dart';
    const cmd = getExecCommand(toolName, updatedDeps, isLockFileMaintenance);

    let constraint = config.constraints?.[toolName];
    if (!constraint) {
      const pubspec = parsePubspec(packageFileName, newPackageFileContent);
      const pubspecToolName = isFlutter ? 'flutter' : 'sdk';
      constraint = pubspec?.environment[pubspecToolName];

      if (!constraint) {
        const pubspecLock = parsePubspecLock(lockFileName, oldLockFileContent);
        constraint = pubspecLock?.sdks[toolName];
      }
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

    return await updateLockFile({
      lockFileName,
      existingLockFileContent: oldLockFileContent,
      packageFile: { path: packageFileName, contents: newPackageFileContent },
      run: () => exec(cmd, execOptions),
    });
  } catch (err) {
    /* v8 ignore if -- defensive rethrow, not reproduced in the pub specs */
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn({ lockfile: lockFileName, err }, `Failed to update lock file`);
    return artifactErrorResult(lockFileName, err);
  }
}

function getExecCommand(
  toolName: string,
  updatedDeps: Upgrade<Record<string, unknown>>[],
  isLockFileMaintenance: boolean | undefined,
): string {
  if (isLockFileMaintenance) {
    return `${toolName} pub upgrade`;
  }
  const depNames = updatedDeps.map((dep) => dep.depName).filter(isString);
  if (depNames.length === 1 && SDK_NAMES.includes(depNames[0])) {
    return `${toolName} ${PUB_GET_COMMAND}`;
  }
  // If there are two updated dependencies and both of them are SDK updates (Dart and Flutter),
  // we use Flutter over Dart to run `pub get` as it is a Flutter project.
  if (
    depNames.length === 2 &&
    depNames.filter((depName) => SDK_NAMES.includes(depName)).length === 2
  ) {
    return `flutter ${PUB_GET_COMMAND}`;
  }
  const depNamesCmd = depNames
    .filter((depName) => !SDK_NAMES.includes(depName))
    .map(quote)
    .join(' ');
  return `${toolName} pub upgrade ${depNamesCmd}`;
}

import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  getParentDir,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';
import { extractSwiftToolsVersion } from './util';

async function swiftPackageResolve(
  packageFile: string,
  toolsVersion: string,
  config: UpdateArtifactsConfig
): Promise<void> {
  const packagePath = getParentDir(packageFile);
  const cmd = `swift package resolve --package-path ${quote(packagePath)}`;
  const execOptions: ExecOptions = {
    docker: {
      image: 'sidecar',
    },
    toolConstraints: [
      {
        toolName: 'swift',
        constraint: config.constraints?.swift ?? '^' + toolsVersion,
      },
    ],
  };
  await exec(cmd, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`swift.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated swift deps - returning null');
    return null;
  }

  const lockFile = getSiblingFileName(packageFileName, 'Package.resolved');
  const lockFileExists = await localPathExists(lockFile);
  const existingLockFileContent = lockFileExists
    ? await readLocalFile(lockFile)
    : null;
  if (!existingLockFileContent || !lockFileExists) {
    logger.debug('No Package.resolved file found');
    return null;
  }
  try {
    const toolsVersion = extractSwiftToolsVersion(newPackageFileContent);
    if (toolsVersion === null) {
      throw new Error(
        `${packageFileName} does not specify a valid swift tools version`
      );
    }

    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFile);
    await swiftPackageResolve(packageFileName, toolsVersion, config);
    logger.debug('Returning updated Package.resolved file');
    const newLockFileContent = await readLocalFile(lockFile);
    if (existingLockFileContent === newLockFileContent) {
      logger.debug('Package.resolved file is unchanged');
      return null;
    }
    return [
      {
        file: {
          type: 'addition',
          path: lockFile,
          contents: newLockFileContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update Package.resolved file');
    return [
      {
        artifactError: {
          lockFile,
          stderr: err.message,
        },
      },
    ];
  }
}

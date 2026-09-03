import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { withGitEnvironment } from '../../../util/git/exec.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

const gitExec = withGitEnvironment(['conan']);

async function conanLockUpdate(
  conanFilePath: string,
  isLockFileMaintenance: boolean | undefined,
  conanConstraint?: string,
  pythonConstraint?: string,
): Promise<void> {
  const command = `conan lock create ${quote(conanFilePath)}${isLockFileMaintenance ? ' --lockfile=""' : ''}`;

  const execOptions: ExecOptions = {
    toolConstraints: [
      {
        toolName: 'python',
        constraint: pythonConstraint,
      },
      {
        toolName: 'conan',
        constraint: conanConstraint,
      },
    ],
    docker: {},
  };

  await gitExec(command, execOptions);
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;

  logger.trace(`conan.updateArtifacts(${packageFileName})`);

  const { isLockFileMaintenance } = config;

  if (updatedDeps.length === 0 && !isLockFileMaintenance) {
    logger.trace('No conan.lock dependencies to update');
    return null;
  }

  const lockFileName = await findLocalSiblingOrParent(
    packageFileName,
    'conan.lock',
  );
  if (!lockFileName) {
    logger.trace('No conan.lock found');
    return null;
  }

  const existingLockFileContent = await readLocalFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug(`${lockFileName} read operation failed`);
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    logger.trace(`Updating ${lockFileName}`);
    await conanLockUpdate(
      packageFileName,
      isLockFileMaintenance,
      config.constraints?.conan,
      config.constraints?.python,
    );

    const newLockFileContent = await readLocalFile(lockFileName);
    if (!newLockFileContent) {
      logger.debug(`New ${lockFileName} read operation failed`);
      return null;
    }

    if (existingLockFileContent === newLockFileContent) {
      logger.trace(`${lockFileName} is unchanged`);
      return null;
    }

    logger.trace(`Returning updated ${lockFileName}`);
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

    logger.debug(
      { err, packageFileName, lockFileName },
      'Lockfile update failed',
    );

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

import { isEmptyArray, isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  deleteLocalFile,
  findLocalSiblingOrParent,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';

import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`rebar3.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (isEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated rebar3 deps');
    return null;
  }

  let lockFileName = getSiblingFileName(packageFileName, 'rebar.lock');

  let existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    if (await localPathExists(lockFileName)) {
      return [
        {
          artifactError: {
            fileName: lockFileName,
            stderr: `Error reading ${lockFileName}`,
          },
        },
      ];
    }

    const parentLockFileName = await findLocalSiblingOrParent(
      packageFileName,
      'rebar.lock',
    );
    if (parentLockFileName) {
      existingLockFileContent = await readLocalFile(parentLockFileName, 'utf8');
      if (existingLockFileContent) {
        lockFileName = parentLockFileName;
      } else if (await localPathExists(parentLockFileName)) {
        return [
          {
            artifactError: {
              fileName: parentLockFileName,
              stderr: `Error reading ${parentLockFileName}`,
            },
          },
        ];
      }
    }
  }

  if (isLockFileMaintenance && !existingLockFileContent) {
    logger.debug(
      'Cannot use lockFileMaintenance when no rebar.lock file is present',
    );
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }
  } catch (err) {
    logger.warn({ err }, 'rebar.config could not be written');
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  if (!existingLockFileContent) {
    logger.debug('No rebar.lock found');
    return null;
  }

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    docker: {},
    toolConstraints: [
      {
        toolName: 'erlang',
        constraint: config.constraints?.erlang ?? '^26',
      },
    ],
  };

  let command: string;
  if (isLockFileMaintenance) {
    command = 'rebar3 upgrade --all';
  } else {
    command = [
      'rebar3',
      'upgrade',
      ...updatedDeps
        .map((dep) => dep.depName)
        .filter(isString)
        .map((dep) => quote(dep)),
    ].join(' ');
  }

  try {
    await exec(command, execOptions);
  } catch (err) {
    /* v8 ignore next 3 */
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    logger.debug(
      { err, message: err.message, command },
      'Failed to update rebar3 lock file',
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

  const newLockContent = await readLocalFile(lockFileName, 'utf8');
  if (existingLockFileContent === newLockContent) {
    logger.debug('rebar.lock is unchanged');
    return null;
  }
  logger.debug('Returning updated rebar.lock');
  return [
    {
      file: {
        type: 'addition',
        path: lockFileName,
        contents: newLockContent,
      },
    },
  ];
}

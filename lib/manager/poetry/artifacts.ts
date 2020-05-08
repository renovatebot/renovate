import is from '@sindresorhus/is';
import fs from 'fs-extra';
import { parse } from 'toml';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../common';

function getPythonConstraint(
  existingLockFileContent: string,
  config: UpdateArtifactsConfig
): string | undefined | null {
  const { compatibility = {} } = config;
  const { python } = compatibility;

  if (python) {
    logger.debug('Using python constraint from config');
    return python;
  }
  try {
    const data = parse(existingLockFileContent);
    if (data?.metadata?.['python-versions']) {
      return data?.metadata?.['python-versions'];
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
  logger.debug(`poetry.updateArtifacts(${packageFileName})`);
  if (!is.nonEmptyArray(updatedDeps) && !config.isLockFileMaintenance) {
    logger.debug('No updated poetry deps - returning null');
    return null;
  }
  // Try poetry.lock first
  let lockFileName = getSiblingFileName(packageFileName, 'poetry.lock');
  let existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    // Try pyproject.lock next
    lockFileName = getSiblingFileName(packageFileName, 'pyproject.lock');
    existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (!existingLockFileContent) {
      logger.debug(`No lock file found`);
      return null;
    }
  }
  logger.debug(`Updating ${lockFileName}`);
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    const cmd: string[] = [];
    if (config.isLockFileMaintenance) {
      await fs.remove(lockFileName);
      cmd.push('poetry update --lock --no-interaction');
    } else {
      for (let i = 0; i < updatedDeps.length; i += 1) {
        const dep = updatedDeps[i];
        cmd.push(`poetry update --lock --no-interaction ${dep}`);
      }
    }
    const tagConstraint = getPythonConstraint(existingLockFileContent, config);
    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {
        image: 'renovate/python',
        tagConstraint,
        tagScheme: 'poetry',
        preCommands: [
          'pip install ' + (config.compatibility?.poetry || 'poetry'),
        ],
      },
    };
    await exec(cmd, execOptions);
    const newPoetryLockContent = await readLocalFile(lockFileName, 'utf8');
    if (existingLockFileContent === newPoetryLockContent) {
      logger.debug(`${lockFileName} is unchanged`);
      return null;
    }
    logger.debug(`Returning updated ${lockFileName}`);
    return [
      {
        file: {
          name: lockFileName,
          contents: newPoetryLockContent,
        },
      },
    ];
  } catch (err) {
    logger.debug({ err }, `Failed to update ${lockFileName} file`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.stdout + '\n' + err.stderr,
        },
      },
    ];
  }
}

import { parse } from '@iarna/toml';
import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  deleteLocalFile,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import { find } from '../../util/host-rules';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';
import type { PoetryFile, PoetrySource } from './types';

function getPythonConstraint(
  existingLockFileContent: string,
  config: UpdateArtifactsConfig
): string | undefined | null {
  const { constraints = {} } = config;
  const { python } = constraints;

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

function getPoetrySources(content: string, fileName: string): PoetrySource[] {
  let pyprojectFile: PoetryFile;
  try {
    pyprojectFile = parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing pyproject.toml file');
    return [];
  }
  if (!pyprojectFile.tool?.poetry) {
    logger.debug(`{$fileName} contains no poetry section`);
    return [];
  }

  const sources = pyprojectFile.tool?.poetry?.source || [];
  const sourceArray: PoetrySource[] = [];
  for (const source of sources) {
    if (source.name && source.url) {
      sourceArray.push({ name: source.name, url: source.url });
    }
  }
  return sourceArray;
}

function getSourceCredentialVars(
  pyprojectContent: string,
  packageFileName: string
): Record<string, string> {
  const poetrySources = getPoetrySources(pyprojectContent, packageFileName);
  const envVars: Record<string, string> = {};

  for (const source of poetrySources) {
    const matchingHostRule = find({ url: source.url });
    const formattedSourceName = source.name.toUpperCase();
    if (matchingHostRule.username) {
      envVars[`POETRY_HTTP_BASIC_${formattedSourceName}_USERNAME`] =
        matchingHostRule.username;
    }
    if (matchingHostRule.password) {
      envVars[`POETRY_HTTP_BASIC_${formattedSourceName}_PASSWORD`] =
        matchingHostRule.password;
    }
  }
  return envVars;
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
      await deleteLocalFile(lockFileName);
      cmd.push('poetry update --lock --no-interaction');
    } else {
      for (let i = 0; i < updatedDeps.length; i += 1) {
        const dep = updatedDeps[i];
        cmd.push(`poetry update --lock --no-interaction ${quote(dep)}`);
      }
    }
    const tagConstraint = getPythonConstraint(existingLockFileContent, config);
    const poetryRequirement = config.constraints?.poetry || 'poetry';
    const poetryInstall =
      'pip install ' + poetryRequirement.split(' ').map(quote).join(' ');
    const extraEnv = getSourceCredentialVars(
      newPackageFileContent,
      packageFileName
    );

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv,
      docker: {
        image: 'python',
        tagConstraint,
        tagScheme: 'poetry',
        preCommands: [poetryInstall],
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
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, `Failed to update ${lockFileName} file`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: `${String(err.stdout)}\n${String(err.stderr)}`,
        },
      },
    ];
  }
}

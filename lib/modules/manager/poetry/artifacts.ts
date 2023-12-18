import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  deleteLocalFile,
  ensureCacheDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getGitEnvironmentVariables } from '../../../util/git/auth';
import { find } from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { Result } from '../../../util/result';
import { parse as parseToml } from '../../../util/toml';
import { PypiDatasource } from '../../datasource/pypi';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { Lockfile, PoetrySchemaToml } from './schema';
import type { PoetryFile, PoetrySource } from './types';

export function getPythonConstraint(
  pyProjectContent: string,
  existingLockFileContent: string,
): string | null {
  // Read Python version from `pyproject.toml` first as it could have been updated
  const pyprojectPythonConstraint = Result.parse(
    pyProjectContent,
    PoetrySchemaToml.transform(
      ({ packageFileContent }) =>
        packageFileContent.deps.find((dep) => dep.depName === 'python')
          ?.currentValue,
    ),
  ).unwrapOrNull();
  if (pyprojectPythonConstraint) {
    logger.debug('Using python version from pyproject.toml');
    return pyprojectPythonConstraint;
  }

  const lockfilePythonConstraint = Result.parse(
    existingLockFileContent,
    Lockfile.transform(({ pythonVersions }) => pythonVersions),
  ).unwrapOrNull();
  if (lockfilePythonConstraint) {
    logger.debug('Using python version from poetry.lock');
    return lockfilePythonConstraint;
  }

  return null;
}

export function getPoetryRequirement(
  pyProjectContent: string,
  existingLockFileContent: string,
): undefined | string | null {
  // Read Poetry version from first line of poetry.lock
  const firstLine = existingLockFileContent.split('\n')[0];
  const poetryVersionMatch = firstLine.match(/by Poetry ([\d\\.]+)/);
  if (poetryVersionMatch?.[1]) {
    logger.debug('Using poetry version from poetry.lock header');
    return poetryVersionMatch[1];
  }

  const { val: lockfilePoetryConstraint } = Result.parse(
    existingLockFileContent,
    Lockfile.transform(({ poetryConstraint }) => poetryConstraint),
  ).unwrap();
  if (lockfilePoetryConstraint) {
    logger.debug('Using poetry version from poetry.lock metadata');
    return lockfilePoetryConstraint;
  }

  const { val: pyprojectPoetryConstraint } = Result.parse(
    pyProjectContent,
    PoetrySchemaToml.transform(({ poetryRequirement }) => poetryRequirement),
  ).unwrap();
  if (pyprojectPoetryConstraint) {
    logger.debug('Using poetry version from pyproject.toml');
    return pyprojectPoetryConstraint;
  }

  return null;
}

function getPoetrySources(content: string, fileName: string): PoetrySource[] {
  let pyprojectFile: PoetryFile;
  try {
    pyprojectFile = parseToml(content) as PoetryFile;
  } catch (err) {
    logger.debug({ err }, 'Error parsing pyproject.toml file');
    return [];
  }
  if (!pyprojectFile.tool?.poetry) {
    logger.debug(`{$fileName} contains no poetry section`);
    return [];
  }

  const sources = pyprojectFile.tool?.poetry?.source ?? [];
  const sourceArray: PoetrySource[] = [];
  for (const source of sources) {
    if (source.name && source.url) {
      sourceArray.push({ name: source.name, url: source.url });
    }
  }
  return sourceArray;
}

function getMatchingHostRule(url: string | undefined): HostRule {
  const scopedMatch = find({ hostType: PypiDatasource.id, url });
  return is.nonEmptyObject(scopedMatch) ? scopedMatch : find({ url });
}

function getSourceCredentialVars(
  pyprojectContent: string,
  packageFileName: string,
): NodeJS.ProcessEnv {
  const poetrySources = getPoetrySources(pyprojectContent, packageFileName);
  const envVars: NodeJS.ProcessEnv = {};

  for (const source of poetrySources) {
    const matchingHostRule = getMatchingHostRule(source.url);
    const formattedSourceName = source.name
      .replace(regEx(/(\.|-)+/g), '_')
      .toUpperCase();
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
  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (!is.nonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
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
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
      cmd.push('poetry update --lock --no-interaction');
    } else {
      cmd.push(
        `poetry update --lock --no-interaction ${updatedDeps
          .map((dep) => dep.depName)
          .filter(is.string)
          .map((dep) => quote(dep))
          .join(' ')}`,
      );
    }
    const pythonConstraint =
      config?.constraints?.python ??
      getPythonConstraint(newPackageFileContent, existingLockFileContent);
    const poetryConstraint =
      config.constraints?.poetry ??
      getPoetryRequirement(newPackageFileContent, existingLockFileContent);
    const extraEnv = {
      ...getSourceCredentialVars(newPackageFileContent, packageFileName),
      ...getGitEnvironmentVariables(['poetry']),
      PIP_CACHE_DIR: await ensureCacheDir('pip'),
    };

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv,
      docker: {},
      toolConstraints: [
        { toolName: 'python', constraint: pythonConstraint },
        { toolName: 'poetry', constraint: poetryConstraint },
      ],
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
          type: 'addition',
          path: lockFileName,
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

import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { parse } from 'toml';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  deleteLocalFile,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import { find } from '../../util/host-rules';
import {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../common';
import { getPoetrySources } from './extract';

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

async function getSourceCredentialVars(
  packageFileName: string
): { [s: string]: string } {
  const pyprojectFileName = getSiblingFileName(
    packageFileName,
    'pyproject.toml'
  );
  const pyprojectContent = await readLocalFile(pyprojectFileName, 'utf8');
  if (!pyprojectContent) {
    logger.debug(`No pyproject.toml found`);
    return {};
  }

  const poetrySources = await getPoetrySources(
    pyprojectContent,
    pyprojectFileName
  );
  const envVars = {};

  for (const source of sources) {
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
    logger.error('No updated poetry deps - returning null');
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
    const poetryRequirement = config.compatibility?.poetry || 'poetry';
    const poetryInstall = 'pip install ' + quote(poetryRequirement);
    const sourceCredentialVars = await getSourceCredentialVars(packageFileName);

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv: sourceCredentialVars,
      docker: {
        image: 'renovate/python',
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
    logger.debug({ err }, `Failed to update ${lockFileName} file`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: `${err.stdout}\n${err.stderr}`,
        },
      },
    ];
  }
}

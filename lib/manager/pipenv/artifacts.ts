import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  deleteLocalFile,
  ensureCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

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
    const pipfileLock = JSON.parse(existingLockFileContent);
    if (pipfileLock?._meta?.requires?.python_version) {
      const pythonVersion: string = pipfileLock._meta.requires.python_version;
      return `== ${pythonVersion}.*`;
    }
    if (pipfileLock?._meta?.requires?.python_full_version) {
      const pythonFullVersion: string =
        pipfileLock._meta.requires.python_full_version;
      return `== ${pythonFullVersion}`;
    }
  } catch (err) {
    // Do nothing
  }
  return undefined;
}

function getPipenvConstraint(
  existingLockFileContent: string,
  config: UpdateArtifactsConfig
): string | null {
  const { constraints = {} } = config;
  const { pipenv } = constraints;

  if (pipenv) {
    logger.debug('Using pipenv constraint from config');
    return pipenv;
  }
  try {
    const pipfileLock = JSON.parse(existingLockFileContent);
    if (pipfileLock?.default?.pipenv?.version) {
      const pipenvVersion: string = pipfileLock.default.pipenv.version;
      return pipenvVersion;
    }
    if (pipfileLock?.develop?.pipenv?.version) {
      const pipenvVersion: string = pipfileLock.develop.pipenv.version;
      return pipenvVersion;
    }
  } catch (err) {
    // Do nothing
  }
  return '';
}

const pipEnvEnvironmentVariablePrefix = 'PIPENV_ENV_';

function getPipenvEnvironment(): Record<string, string> {
  const pipenvKeys = Object.keys(process.env).filter((key) =>
    key.startsWith(pipEnvEnvironmentVariablePrefix)
  );
  const pipenvTargets = pipenvKeys.map((key) => ({
    envKey: key,
    targetEnvKey: key.slice(pipEnvEnvironmentVariablePrefix.length),
  }));
  const pipenvEnvironment = Object.fromEntries(
    pipenvTargets.map(({ envKey, targetEnvKey }) => [
      targetEnvKey,
      process.env[envKey],
    ])
  );
  return pipenvEnvironment;
}

export async function updateArtifacts({
  packageFileName: pipfileName,
  newPackageFileContent: newPipfileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pipenv.updateArtifacts(${pipfileName})`);

  const cacheDir = await ensureCacheDir('./others/pipenv', 'PIPENV_CACHE_DIR');
  logger.debug(`Using pipenv cache ${cacheDir}`);
  const extraEnv = {
    ...getPipenvEnvironment(),
    PIPENV_CACHE_DIR: cacheDir,
  };
  logger.debug(`Using pipenv environment variables ${extraEnv.toString()}`);

  const lockFileName = pipfileName + '.lock';
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No Pipfile.lock found');
    return null;
  }
  try {
    await writeLocalFile(pipfileName, newPipfileContent);
    if (config.isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }
    const cmd = 'pipenv lock';
    const tagConstraint = getPythonConstraint(existingLockFileContent, config);
    const pipenvConstraint = getPipenvConstraint(
      existingLockFileContent,
      config
    );
    const execOptions: ExecOptions = {
      cwdFile: pipfileName,
      extraEnv,
      docker: {
        image: 'python',
        tagConstraint,
        tagScheme: 'pep440',
        preCommands: [
          `pip install --user ${quote(`pipenv${pipenvConstraint}`)}`,
        ],
        volumes: [cacheDir],
      },
    };
    logger.debug({ cmd }, 'pipenv lock command');
    await exec(cmd, execOptions);
    const status = await getRepoStatus();
    if (!status?.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated Pipfile.lock');
    return [
      {
        file: {
          name: lockFileName,
          contents: await readLocalFile(lockFileName, 'utf8'),
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update Pipfile.lock');
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

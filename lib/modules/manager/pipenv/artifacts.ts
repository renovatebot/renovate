import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  deleteLocalFile,
  ensureCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';
import { PipfileLockSchema } from './schema';

export function getPythonConstraint(
  existingLockFileContent: string,
  config: UpdateArtifactsConfig
): string | undefined {
  const { constraints = {} } = config;
  const { python } = constraints;

  if (python) {
    logger.debug('Using python constraint from config');
    return python;
  }
  try {
    const result = PipfileLockSchema.safeParse(
      JSON.parse(existingLockFileContent)
    );
    // istanbul ignore if: not easily testable
    if (!result.success) {
      logger.warn({ error: result.error }, 'Invalid Pipfile.lock');
      return undefined;
    }
    if (result.data._meta?.requires?.python_version) {
      const pythonVersion = result.data._meta.requires.python_version;
      return `== ${pythonVersion}.*`;
    }
    if (result.data._meta?.requires?.python_full_version) {
      const pythonFullVersion = result.data._meta.requires.python_full_version;
      return `== ${pythonFullVersion}`;
    }
  } catch (err) {
    // Do nothing
  }
  return undefined;
}

export function getPipenvConstraint(
  existingLockFileContent: string,
  config: UpdateArtifactsConfig
): string {
  const { constraints = {} } = config;
  const { pipenv } = constraints;

  if (pipenv) {
    logger.debug('Using pipenv constraint from config');
    return pipenv;
  }
  try {
    const result = PipfileLockSchema.safeParse(
      JSON.parse(existingLockFileContent)
    );
    // istanbul ignore if: not easily testable
    if (!result.success) {
      logger.warn({ error: result.error }, 'Invalid Pipfile.lock');
      return '';
    }
    if (result.data.default?.pipenv?.version) {
      return result.data.default.pipenv.version;
    }
    if (result.data.develop?.pipenv?.version) {
      return result.data.develop.pipenv.version;
    }
  } catch (err) {
    // Do nothing
  }
  return '';
}

export async function updateArtifacts({
  packageFileName: pipfileName,
  newPackageFileContent: newPipfileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pipenv.updateArtifacts(${pipfileName})`);

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
      extraEnv: {
        PIPENV_CACHE_DIR: await ensureCacheDir('pipenv'),
        PIP_CACHE_DIR: await ensureCacheDir('pip'),
      },
      docker: {},
      toolConstraints: [
        {
          toolName: 'python',
          constraint: tagConstraint,
        },
        {
          toolName: 'pipenv',
          constraint: pipenvConstraint,
        },
      ],
    };
    logger.trace({ cmd }, 'pipenv lock command');
    await exec(cmd, execOptions);
    const status = await getRepoStatus();
    if (!status?.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated Pipfile.lock');
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
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

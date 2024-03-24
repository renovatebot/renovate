import is from '@sindresorhus/is';
import semver from 'semver';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import { exec } from '../../../util/exec';
import type { ExecOptions, ExtraEnv, Opt } from '../../../util/exec/types';
import {
  deleteLocalFile,
  ensureCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { find } from '../../../util/host-rules';
import { PypiDatasource } from '../../datasource/pypi';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';
import { extractPackageFile } from './extract';
import { PipfileLockSchema } from './schema';

export function getPythonConstraint(
  existingLockFileContent: string,
  config: UpdateArtifactsConfig,
): string | undefined {
  const { constraints = {} } = config;
  const { python } = constraints;

  if (python) {
    logger.debug('Using python constraint from config');
    return python;
  }
  try {
    const result = PipfileLockSchema.safeParse(existingLockFileContent);
    // istanbul ignore if: not easily testable
    if (!result.success) {
      logger.warn({ error: result.error }, 'Invalid Pipfile.lock');
      return undefined;
    }
    // Exact python version has been included since 2022.10.9. It is more specific than the major.minor version
    // https://github.com/pypa/pipenv/blob/main/CHANGELOG.md#2022109-2022-10-09
    if (result.data._meta?.requires?.python_full_version) {
      const pythonFullVersion = result.data._meta.requires.python_full_version;
      return `== ${pythonFullVersion}`;
    }
    // Before 2022.10.9, only the major.minor version was included
    if (result.data._meta?.requires?.python_version) {
      const pythonVersion = result.data._meta.requires.python_version;
      return `== ${pythonVersion}.*`;
    }
  } catch (err) {
    // Do nothing
  }
  return undefined;
}

export function getPipenvConstraint(
  existingLockFileContent: string,
  config: UpdateArtifactsConfig,
): string {
  const { constraints = {} } = config;
  const { pipenv } = constraints;

  if (pipenv) {
    logger.debug('Using pipenv constraint from config');
    return pipenv;
  }
  try {
    const result = PipfileLockSchema.safeParse(existingLockFileContent);
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
    // Exact python version has been included since 2022.10.9
    const pythonFullVersion = result.data._meta?.requires?.python_full_version;
    if (is.string(pythonFullVersion) && semver.valid(pythonFullVersion)) {
      // python_full_version was added after 3.6 was already deprecated, so it should be impossible to have a 3.6 version
      // https://github.com/pypa/pipenv/blob/main/CHANGELOG.md#2022109-2022-10-09
      if (semver.satisfies(pythonFullVersion, '3.7.*')) {
        // Python 3.7 support was dropped in pipenv 2023.10.20
        // https://github.com/pypa/pipenv/blob/main/CHANGELOG.md#20231020-2023-10-20
        return '< 2023.10.20';
      }
      // Future deprecations will go here
    }
    // Before 2022.10.9, only the major.minor version was included
    const pythonVersion = result.data._meta?.requires?.python_version;
    if (pythonVersion) {
      if (pythonVersion === '3.6') {
        // Python 3.6 was deprecated in 2022.4.20
        // https://github.com/pypa/pipenv/blob/main/CHANGELOG.md#2022420-2022-04-20
        return '< 2022.4.20';
      }
      if (pythonVersion === '3.7') {
        // Python 3.7 was deprecated in 2023.10.20 but we shouldn't reach here unless we are < 2022.10.9
        // https://github.com/pypa/pipenv/blob/main/CHANGELOG.md#20231020-2023-10-20
        return '< 2022.10.9';
      }
    }
  } catch (err) {
    // Do nothing
  }
  return '';
}

function getMatchingHostRule(url: string): HostRule {
  return find({ hostType: PypiDatasource.id, url });
}

async function findPipfileSourceUrlWithCredentials(
  pipfileContent: string,
  pipfileName: string,
): Promise<string | null> {
  const pipfile = await extractPackageFile(pipfileContent, pipfileName);
  if (!pipfile) {
    logger.debug('Error parsing Pipfile');
    return null;
  }

  const credentialTokens = [
    '$USERNAME:',
    // eslint-disable-next-line no-template-curly-in-string
    '${USERNAME}',
    '$PASSWORD@',
    // eslint-disable-next-line no-template-curly-in-string
    '${PASSWORD}',
  ];

  const sourceWithCredentials = pipfile.registryUrls?.find((url) =>
    credentialTokens.some((token) => url.includes(token)),
  );

  // Only one source is currently supported
  return sourceWithCredentials ?? null;
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
      config,
    );
    const extraEnv: Opt<ExtraEnv> = {
      PIPENV_CACHE_DIR: await ensureCacheDir('pipenv'),
      PIP_CACHE_DIR: await ensureCacheDir('pip'),
      WORKON_HOME: await ensureCacheDir('virtualenvs'),
    };
    const execOptions: ExecOptions = {
      cwdFile: pipfileName,
      docker: {},
      userConfiguredEnv: config.env,
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

    const sourceUrl = await findPipfileSourceUrlWithCredentials(
      newPipfileContent,
      pipfileName,
    );
    if (sourceUrl) {
      logger.debug({ sourceUrl }, 'Pipfile contains credentials');
      const hostRule = getMatchingHostRule(sourceUrl);
      if (hostRule) {
        logger.debug('Found matching hostRule for Pipfile credentials');
        if (hostRule.username) {
          logger.debug('Adding USERNAME environment variable for pipenv');
          extraEnv.USERNAME = hostRule.username;
        }
        if (hostRule.password) {
          logger.debug('Adding PASSWORD environment variable for pipenv');
          extraEnv.PASSWORD = hostRule.password;
        }
      }
    }
    execOptions.extraEnv = extraEnv;

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

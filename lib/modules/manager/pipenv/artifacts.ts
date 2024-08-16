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
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { find } from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { parse as parseToml } from '../../../util/toml';
import { parseUrl } from '../../../util/url';
import { PypiDatasource } from '../../datasource/pypi';
import pep440 from '../../versioning/pep440';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';
import { extractPackageFile } from './extract';
import { PipfileLockSchema } from './schema';

export async function getPythonConstraint(
  pipfileName: string,
  pipfileContent: string,
  existingLockFileContent: string,
  config: UpdateArtifactsConfig,
): Promise<string | undefined> {
  const { constraints = {} } = config;
  const { python } = constraints;

  if (python) {
    logger.debug(`Using python constraint ${python} from config`);
    return python;
  }

  // Try Pipfile first because it may have had its Python version updated
  try {
    const pipfile = parseToml(pipfileContent) as any;
    const pythonFullVersion = pipfile.requires.python_full_version;
    if (pythonFullVersion) {
      logger.debug(
        `Using python full version ${pythonFullVersion} from Pipfile`,
      );
      return `== ${pythonFullVersion}`;
    }
    const pythonVersion = pipfile.requires.python_version;
    if (pythonVersion) {
      logger.debug(`Using python version ${pythonVersion} from Pipfile`);
      return `== ${pythonVersion}.*`;
    }
  } catch (err) {
    logger.warn({ err }, 'Error parsing Pipfile');
  }

  // Try Pipfile.lock next
  try {
    const result = PipfileLockSchema.safeParse(existingLockFileContent);
    // istanbul ignore if: not easily testable
    if (!result.success) {
      logger.warn({ err: result.error }, 'Invalid Pipfile.lock');
      return undefined;
    }
    // Exact python version has been included since 2022.10.9. It is more specific than the major.minor version
    // https://github.com/pypa/pipenv/blob/main/CHANGELOG.md#2022109-2022-10-09
    const pythonFullVersion = result.data._meta?.requires?.python_full_version;
    if (pythonFullVersion) {
      logger.debug(
        `Using python full version ${pythonFullVersion} from Pipfile.lock`,
      );
      return `== ${pythonFullVersion}`;
    }
    // Before 2022.10.9, only the major.minor version was included
    const pythonVersion = result.data._meta?.requires?.python_version;
    if (pythonVersion) {
      logger.debug(`Using python version ${pythonVersion} from Pipfile.lock`);
      return `== ${pythonVersion}.*`;
    }
  } catch {
    // Do nothing
  }

  // Try looking for the contents of .python-version
  const pythonVersionFileName = getSiblingFileName(
    pipfileName,
    '.python-version',
  );
  try {
    const pythonVersion = await readLocalFile(pythonVersionFileName, 'utf8');
    let pythonVersionConstraint;
    if (pythonVersion && pep440.isVersion(pythonVersion)) {
      if (pythonVersion.split('.').length >= 3) {
        pythonVersionConstraint = `== ${pythonVersion}`;
      } else {
        pythonVersionConstraint = `== ${pythonVersion}.*`;
      }
    }
    if (pythonVersionConstraint) {
      logger.debug(
        `Using python version ${pythonVersionConstraint} from ${pythonVersionFileName}`,
      );
      return pythonVersionConstraint;
    }
  } catch {
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
  } catch {
    // Do nothing
  }
  return '';
}

export function getMatchingHostRule(url: string): HostRule | null {
  const parsedUrl = parseUrl(url);
  if (parsedUrl) {
    parsedUrl.username = '';
    parsedUrl.password = '';
    const urlWithoutCredentials = parsedUrl.toString();

    return find({ hostType: PypiDatasource.id, url: urlWithoutCredentials });
  }
  return null;
}

async function findPipfileSourceUrlsWithCredentials(
  pipfileContent: string,
  pipfileName: string,
): Promise<URL[]> {
  const pipfile = await extractPackageFile(pipfileContent, pipfileName);

  return (
    pipfile?.registryUrls
      ?.map(parseUrl)
      .filter(is.urlInstance)
      .filter((url) => is.nonEmptyStringAndNotWhitespace(url.username)) ?? []
  );
}

/**
 * This will extract the actual variable name from an environment-placeholder:
 * ${USERNAME:-defaultvalue} will yield 'USERNAME'
 */
export function extractEnvironmentVariableName(
  credential: string,
): string | null {
  const match = regEx('([a-z0-9_]+)', 'i').exec(decodeURI(credential));
  return match?.length ? match[0] : null;
}

export function addExtraEnvVariable(
  extraEnv: ExtraEnv<unknown>,
  environmentVariableName: string,
  environmentValue: string,
): void {
  logger.trace(
    `Adding ${environmentVariableName} environment variable for pipenv`,
  );
  if (
    extraEnv[environmentVariableName] &&
    extraEnv[environmentVariableName] !== environmentValue
  ) {
    logger.warn(
      `Possible misconfiguration, ${environmentVariableName} is already set to a different value`,
    );
  }
  extraEnv[environmentVariableName] = environmentValue;
}

/**
 * Pipenv allows configuring source-urls for remote repositories with placeholders for credentials, i.e. http://$USER:$PASS@myprivate.repo
 * if a matching host rule exists for that repository, we need to set the corresponding variables.
 * Simply substituting them in the URL is not an option as it would impact the hash for the resulting Pipfile.lock
 *
 */
async function addCredentialsForSourceUrls(
  newPipfileContent: string,
  pipfileName: string,
  extraEnv: ExtraEnv<unknown>,
): Promise<void> {
  const sourceUrls = await findPipfileSourceUrlsWithCredentials(
    newPipfileContent,
    pipfileName,
  );
  for (const parsedSourceUrl of sourceUrls) {
    logger.trace(`Trying to add credentials for ${parsedSourceUrl.toString()}`);
    const matchingHostRule = getMatchingHostRule(parsedSourceUrl.toString());
    if (matchingHostRule) {
      const usernameVariableName = extractEnvironmentVariableName(
        parsedSourceUrl.username,
      );
      if (matchingHostRule.username && usernameVariableName) {
        addExtraEnvVariable(
          extraEnv,
          usernameVariableName,
          matchingHostRule.username,
        );
      }
      const passwordVariableName = extractEnvironmentVariableName(
        parsedSourceUrl.password,
      );
      if (matchingHostRule.password && passwordVariableName) {
        addExtraEnvVariable(
          extraEnv,
          passwordVariableName,
          matchingHostRule.password,
        );
      }
    }
  }
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
    const tagConstraint = await getPythonConstraint(
      pipfileName,
      newPipfileContent,
      existingLockFileContent,
      config,
    );
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
    await addCredentialsForSourceUrls(newPipfileContent, pipfileName, extraEnv);
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

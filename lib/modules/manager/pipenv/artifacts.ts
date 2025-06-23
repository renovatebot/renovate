import { pipenv as pipenvDetect } from '@renovatebot/detect-tools';
import is from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import { exec } from '../../../util/exec';
import type { ExecOptions, ExtraEnv, Opt } from '../../../util/exec/types';
import {
  deleteLocalFile,
  ensureCacheDir,
  getParentDir,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { ensureLocalPath } from '../../../util/fs/util';
import { getRepoStatus } from '../../../util/git';
import { find } from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import { PypiDatasource } from '../../datasource/pypi';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { extractPackageFile } from './extract';

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
      { envVar: environmentVariableName },
      'Possible misconfiguration, environment variable already set to a different value',
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
  if (!(await localPathExists(lockFileName))) {
    logger.debug('No Pipfile.lock found');
    return null;
  }
  try {
    await writeLocalFile(pipfileName, newPipfileContent);
    if (config.isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }
    const cmd = 'pipenv lock';
    const pipfileDir = getParentDir(ensureLocalPath(pipfileName));
    const tagConstraint =
      config.constraints?.python ??
      (await pipenvDetect.getPythonConstraint(pipfileDir));
    const pipenvConstraint =
      config.constraints?.pipenv ??
      (await pipenvDetect.getPipenvConstraint(pipfileDir));
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

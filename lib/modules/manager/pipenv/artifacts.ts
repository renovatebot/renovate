import { pipenv as pipenvDetect } from '@renovatebot/detect-tools';
import {
  isNonEmptyStringAndNotWhitespace,
  isUrlInstance,
} from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ExtraEnv, Opt } from '../../../util/exec/types.ts';
import {
  deleteLocalFile,
  ensureCacheDir,
  getParentDir,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { ensureLocalPath } from '../../../util/fs/util.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import { regEx } from '../../../util/regex.ts';
import { parseUrl } from '../../../util/url.ts';
import { findPypiIndexCredentials } from '../../datasource/pypi/host-rules.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { extractPackageFile } from './extract.ts';

async function findPipfileSourceUrlsWithCredentials(
  pipfileContent: string,
  pipfileName: string,
): Promise<URL[]> {
  const pipfile = await extractPackageFile(pipfileContent, pipfileName);

  return coerceArray(
    pipfile?.registryUrls
      ?.map(parseUrl)
      .filter(isUrlInstance)
      .filter((url) => isNonEmptyStringAndNotWhitespace(url.username)),
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
  extraEnv: ExtraEnv,
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
  extraEnv: ExtraEnv,
): Promise<void> {
  const sourceUrls = await findPipfileSourceUrlsWithCredentials(
    newPipfileContent,
    pipfileName,
  );
  for (const parsedSourceUrl of sourceUrls) {
    logger.trace(`Trying to add credentials for ${parsedSourceUrl.toString()}`);
    const credentials = await findPypiIndexCredentials(
      parsedSourceUrl.toString(),
    );
    const usernameVariableName = extractEnvironmentVariableName(
      parsedSourceUrl.username,
    );
    if (credentials.username && usernameVariableName) {
      addExtraEnvVariable(extraEnv, usernameVariableName, credentials.username);
    }
    const passwordVariableName = extractEnvironmentVariableName(
      parsedSourceUrl.password,
    );
    if (credentials.password && passwordVariableName) {
      addExtraEnvVariable(extraEnv, passwordVariableName, credentials.password);
    }
  }
}

export async function updateArtifacts({
  packageFileName: pipfileName,
  newPackageFileContent: newPipfileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pipenv.updateArtifacts(${pipfileName})`);

  const lockFileName = `${pipfileName}.lock`;
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
          fileName: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}

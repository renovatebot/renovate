import { PlatformId } from '../../constants';
import { logger } from '../../logger';
import type { HostRule } from '../../types';
import { getHttpUrl } from './url';

/**
 * Add authorization to a Git Url and returns a new environment variables object
 * @returns a new NodeJS.ProcessEnv object without modifying any input parameters
 */
export function getGitAuthenticatedEnvironmentVariables(
  gitUrl: string,
  { token, hostType, matchHost }: HostRule,
  environmentVariables?: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  if (!token) {
    logger.warn(
      `Could not create environment variable for ${matchHost} as token was empty`
    );
    return { ...environmentVariables };
  }

  // check if the environmentVariables already contain a GIT_CONFIG_COUNT or if the process has one
  const gitConfigCountEnvVariable =
    environmentVariables?.GIT_CONFIG_COUNT || process.env.GIT_CONFIG_COUNT;
  let gitConfigCount = 0;
  if (gitConfigCountEnvVariable) {
    // passthrough the gitConfigCountEnvVariable environment variable as start value of the index count
    gitConfigCount = parseInt(gitConfigCountEnvVariable, 10);
    if (Number.isNaN(gitConfigCount)) {
      logger.warn(
        `Found GIT_CONFIG_COUNT env variable, but couldn't parse the value to an integer: ${process.env.GIT_CONFIG_COUNT}. Ignoring it.`
      );
      gitConfigCount = 0;
    }
  }

  const gitUrlWithToken = getUrlWithToken(gitUrl, hostType, token);

  // create a shallow copy of the environmentVariables as base so we don't modify the input parameter object
  // add the two new config key and value to the returnEnvironmentVariables object
  // increase the CONFIG_COUNT by one and add it to the object
  return {
    ...environmentVariables,
    [`GIT_CONFIG_KEY_${gitConfigCount}`]: `url.${gitUrlWithToken}.insteadOf`,
    [`GIT_CONFIG_VALUE_${gitConfigCount}`]: gitUrl,
    GIT_CONFIG_COUNT: (gitConfigCount + 1).toString(),
  };
}

function getUrlWithToken(
  gitUrl: string,
  hostType: string,
  authToken: string
): string {
  let token = authToken;
  if (hostType === PlatformId.Gitlab) {
    token = `gitlab-ci-token:${token}`;
  }

  return getHttpUrl(gitUrl, token);
}

import { logger } from '../../logger';
import { getHttpUrl } from './url';

function encodeToken(token: string): string {
  // if the token already starts with the `x-access-token:` username we encode only the token part
  // This ensures that GitHub Apps work
  if (token.startsWith('x-access-token:')) {
    const appToken = token.replace('x-access-token:', '');
    return `x-access-token:${encodeURIComponent(appToken)}`;
  }

  return encodeURIComponent(token);
}

/*
    Add authorization to a Git Url and returns the updated environment variables
*/
export function getGitAuthenticatedEnvironmentVariables(
  gitUrl: string,
  token: string,
  environmentVariables?: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
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

  const gitUrlWithToken = getHttpUrl(gitUrl, encodeToken(token));

  // create a shallow copy of the environmentVariables as base so we don't modify the input parameter object
  // add the two new config key and value to the returnEnvironmentVariables object
  // increase the CONFIG_COUNT by one and add it to the object
  const returnEnvironmentVariables = {
    ...environmentVariables,
    [`GIT_CONFIG_KEY_${gitConfigCount}`]: `url.${gitUrlWithToken}.insteadOf`,
    [`GIT_CONFIG_VALUE_${gitConfigCount}`]: gitUrl,
    GIT_CONFIG_COUNT: (gitConfigCount + 1).toString(),
  };

  return returnEnvironmentVariables;
}

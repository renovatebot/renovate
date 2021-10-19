import { logger } from '../../logger';
import { getHttpUrl } from './url';

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

  const gitUrlWithToken = getHttpUrl(gitUrl, encodeURIComponent(token));

  // create a shallow copy of the environmentVariables so we don't modify the input parameter object
  const returnEnvironmentVariables = { ...environmentVariables };

  // prettier-ignore
  returnEnvironmentVariables[`GIT_CONFIG_KEY_${gitConfigCount}`] = `url.${gitUrlWithToken}.insteadOf`;
  // prettier-ignore
  returnEnvironmentVariables[`GIT_CONFIG_VALUE_${gitConfigCount}`] = gitUrl;

  gitConfigCount += 1;
  returnEnvironmentVariables.GIT_CONFIG_COUNT = gitConfigCount.toString();

  return returnEnvironmentVariables;
}

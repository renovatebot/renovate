import { logger } from '../../logger';
import { getRemoteUrlWithToken } from './url';

/*
    Add authorization to a Git Url and returns the updated environment variables
*/
export function getGitAuthenticatedEnvironmentVariables(
  gitUrl: string,
  environmentVariables: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  // check if the environmentVariables already contain a GIT_CONFIG_COUNT or if the process has one
  const gitConfigCountEnvVariable =
    environmentVariables.GIT_CONFIG_COUNT || process.env.GIT_CONFIG_COUNT;
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

  const gitUrlWithToken = getRemoteUrlWithToken(gitUrl);
  const returnEnvironmentVariables = { ...environmentVariables };

  // only if credentials got injected and thus the urls are no longer equal
  if (gitUrlWithToken !== gitUrl) {
    // prettier-ignore
    returnEnvironmentVariables[`GIT_CONFIG_KEY_${gitConfigCount}`] = `url.${gitUrlWithToken}.insteadOf`;
    // prettier-ignore
    returnEnvironmentVariables[`GIT_CONFIG_VALUE_${gitConfigCount}`] = gitUrl;
    gitConfigCount += 1;
  }

  if (gitConfigCount > 0) {
    returnEnvironmentVariables.GIT_CONFIG_COUNT = gitConfigCount.toString();
  }

  return returnEnvironmentVariables;
}

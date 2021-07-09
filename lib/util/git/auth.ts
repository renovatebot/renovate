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
  let gitEnvCounter = 0;
  if (gitConfigCountEnvVariable) {
    // passthrough the gitConfigCountEnvVariable environment variable as start value of the index count
    gitEnvCounter = parseInt(gitConfigCountEnvVariable, 10);
    if (Number.isNaN(gitEnvCounter)) {
      logger.warn(
        `Found GIT_CONFIG_COUNT env variable, but couldn't parse the value to an integer: ${process.env.GIT_CONFIG_COUNT}. Ignoring it.`
      );
      gitEnvCounter = 0;
    }
  }

  const gitUrlWithToken = getRemoteUrlWithToken(gitUrl, 'git');
  const returnEnvironmentVariables = { ...environmentVariables };

  // only if credentials got injected and thus the urls are no longer equal
  if (gitUrlWithToken !== gitUrl) {
    // prettier-ignore
    returnEnvironmentVariables[`GIT_CONFIG_KEY_${gitEnvCounter}`] = `url.${gitUrlWithToken}.insteadOf`;
    // prettier-ignore
    returnEnvironmentVariables[`GIT_CONFIG_VALUE_${gitEnvCounter}`] = gitUrl;
    returnEnvironmentVariables.GIT_CONFIG_COUNT = (
      gitEnvCounter + 1
    ).toString();
  }

  return returnEnvironmentVariables;
}

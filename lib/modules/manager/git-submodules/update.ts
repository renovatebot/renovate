import simpleGit from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { PlatformId } from '../../../constants/platforms';
import { logger } from '../../../logger';
import { getGitAuthenticatedEnvironmentVariables } from '../../../util/git/auth';
import { find, getAll } from '../../../util/host-rules';
import { createURLFromHostOrURL, validateUrl } from '../../../util/url';
import type { UpdateDependencyConfig } from '../types';

export default async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const { localDir } = GlobalConfig.get();
  const gitSubmoduleAuthEnvironmentVariables = getGitEnvironmentVariables();
  const git = simpleGit(localDir).env({
    // pass all existing env variables
    ...process.env,
    // add all known git Variables
    ...gitSubmoduleAuthEnvironmentVariables,
  });
  const submoduleGit = simpleGit(upath.join(localDir, upgrade.depName)).env({
    // pass all existing env variables
    ...process.env,
    // add all known git Variables
    ...gitSubmoduleAuthEnvironmentVariables,
  });
  try {
    await git.submoduleUpdate(['--init', upgrade.depName]);
    await submoduleGit.checkout([upgrade.newDigest]);
    return fileContent;
  } catch (err) {
    logger.debug({ err }, 'submodule checkout error');
    return null;
  }
}

function getGitEnvironmentVariables(): NodeJS.ProcessEnv {
  let environmentVariables: NodeJS.ProcessEnv = {};

  // hard-coded logic to use authentication for github.com based on the githubToken for api.github.com
  const githubToken = find({
    hostType: PlatformId.Github,
    url: 'https://api.github.com/',
  });

  if (githubToken?.token) {
    environmentVariables = getGitAuthenticatedEnvironmentVariables(
      'https://github.com/',
      githubToken
    );
  }

  // get extra host rules for other git-based Go Module hosts
  const hostRules = getAll() || [];

  const submodulesGitAllowedHostType: string[] = [
    // All known git platforms
    PlatformId.Azure,
    PlatformId.Bitbucket,
    PlatformId.BitbucketServer,
    PlatformId.Gitea,
    PlatformId.Github,
    PlatformId.Gitlab,
    // plus all without a host type (=== undefined)
    undefined,
  ];

  // for each hostRule we add additional authentication variables to the environmentVariables
  for (const hostRule of hostRules) {
    if (
      hostRule?.token &&
      hostRule.matchHost &&
      submodulesGitAllowedHostType.includes(hostRule.hostType)
    ) {
      const httpUrl = createURLFromHostOrURL(hostRule.matchHost).toString();
      if (validateUrl(httpUrl)) {
        logger.debug(
          `Adding Git authentication for Git submodule retrieval for ${httpUrl} using token auth.`
        );
        environmentVariables = getGitAuthenticatedEnvironmentVariables(
          httpUrl,
          hostRule,
          environmentVariables
        );
      } else {
        logger.warn(
          `Could not parse registryUrl ${hostRule.matchHost} or not using http(s). Ignoring`
        );
      }
    }
  }
  return environmentVariables;
}

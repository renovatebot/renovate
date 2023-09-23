import Git from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { getGitEnvironmentVariables } from '../../../util/git/auth';
import type { UpdateDependencyConfig } from '../types';

export default async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const localDir = GlobalConfig.get('localDir');
  const gitSubmoduleAuthEnvironmentVariables = getGitEnvironmentVariables();
  const gitEnv = {
    // pass all existing env variables
    ...process.env,
    // add all known git Variables
    ...gitSubmoduleAuthEnvironmentVariables,
  };
  const git = Git(localDir).env(gitEnv);
  const submoduleGit = Git(upath.join(localDir, upgrade.depName));

  try {
    await git.submoduleUpdate(['--init', upgrade.depName!]);
    await submoduleGit.checkout([upgrade.newDigest!]);
    return fileContent;
  } catch (err) {
    logger.debug({ err }, 'submodule checkout error');
    return null;
  }
}

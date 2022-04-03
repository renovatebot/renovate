import Git from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { simpleGitConfig } from '../../../util/git/config';
import type { UpdateDependencyConfig } from '../types';

export default async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const { localDir } = GlobalConfig.get();
  const git = Git(localDir, simpleGitConfig());
  const submoduleGit = Git(upath.join(localDir, upgrade.depName));

  try {
    await git.submoduleUpdate(['--init', upgrade.depName]);
    await submoduleGit.checkout([upgrade.newDigest]);
    return fileContent;
  } catch (err) {
    logger.debug({ err }, 'submodule checkout error');
    return null;
  }
}

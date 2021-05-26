import Git from 'simple-git';
import upath from 'upath';
import { getAdminConfig } from '../../config/admin';
import { logger } from '../../logger';
import type { UpdateDependencyConfig } from '../types';

export default async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const { cloneDir } = getAdminConfig();
  const git = Git(cloneDir);
  const submoduleGit = Git(upath.join(cloneDir, upgrade.depName));

  try {
    await git.submoduleUpdate(['--init', upgrade.depName]);
    await submoduleGit.checkout([upgrade.newDigest]);
    return fileContent;
  } catch (err) {
    logger.debug({ err }, 'submodule checkout error');
    return null;
  }
}

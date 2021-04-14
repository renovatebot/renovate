import Git from 'simple-git';
import upath from 'upath';
import { logger } from '../../logger';
import type { UpdateDependencyConfig } from '../types';

export default async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const git = Git(upgrade.localDir);
  const submoduleGit = Git(upath.join(upgrade.localDir, upgrade.depName));

  try {
    await git.submoduleUpdate(['--init', upgrade.depName]);
    await submoduleGit.checkout([upgrade.newDigest]);
    return fileContent;
  } catch (err) {
    logger.debug({ err }, 'submodule checkout error');
    return null;
  }
}

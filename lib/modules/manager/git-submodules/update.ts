import Git from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import type { UpdateDependencyConfig } from '../types';

export default async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const { localDir } = GlobalConfig.get();
  const git = Git(localDir);
  const submoduleGit = Git(upath.join(localDir, upgrade.depName));

  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    await git.submoduleUpdate(['--init', upgrade.depName!]);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    await submoduleGit.checkout([upgrade.newDigest!]);
    return fileContent;
  } catch (err) {
    logger.debug({ err }, 'submodule checkout error');
    return null;
  }
}

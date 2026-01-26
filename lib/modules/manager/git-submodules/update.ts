import Git from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import { getChildEnv } from '../../../util/exec/utils.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { getGitEnvironmentVariables } from '../../../util/git/auth.ts';
import type { UpdateDependencyConfig } from '../types.ts';

export default async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const localDir = GlobalConfig.get('localDir');
  const gitSubmoduleAuthEnvironmentVariables = getGitEnvironmentVariables([
    'git-tags',
    'git-refs',
  ]);
  const gitEnv = getChildEnv({ env: gitSubmoduleAuthEnvironmentVariables });
  const git = Git(localDir).env(gitEnv);
  const submoduleGit = Git(upath.join(localDir, upgrade.depName)).env(gitEnv);

  try {
    await git.submoduleUpdate(['--checkout', '--init', upgrade.depName!]);
    await submoduleGit.checkout([upgrade.newDigest!]);
    if (upgrade.newValue && upgrade.currentValue !== upgrade.newValue) {
      await git.subModule([
        'set-branch',
        '--branch',
        upgrade.newValue,
        upgrade.depName!,
      ]);
      const updatedPackageContent = await readLocalFile(
        upgrade.packageFile!,
        'utf8',
      );
      return updatedPackageContent!;
    }
    return fileContent;
  } catch (err) {
    logger.debug({ err }, 'submodule checkout error');
    return null;
  }
}

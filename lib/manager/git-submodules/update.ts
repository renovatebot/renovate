import Git from 'simple-git';

import { UpdateDependencyConfig } from '../common';

export default async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const git = Git(upgrade.localDir);

  try {
    await git.raw([
      'submodule',
      'update',
      '--init',
      '--remote',
      upgrade.depName,
    ]);
    return fileContent;
  } catch (err) {
    return null;
  }
}

import Git from 'simple-git/promise';

import { Upgrade } from '../common';

export default async function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): Promise<string | null> {
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

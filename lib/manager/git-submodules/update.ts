import Git from 'simple-git/promise';

import { UpdateDependencyConfig } from '../common';

export default async function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): Promise<string | null> {
  const git = Git(updateOptions.localDir);

  try {
    await git.raw([
      'submodule',
      'update',
      '--init',
      '--remote',
      updateOptions.depName,
    ]);
    return fileContent;
  } catch (err) {
    return null;
  }
}

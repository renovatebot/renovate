import Git from 'simple-git/promise';
import upath from 'upath';

import { ManagerConfig, PackageFile } from '../common';

export default async function extractPackageFile(
  content: string,
  fileName: string,
  config: ManagerConfig
): Promise<PackageFile | null> {
  const git = Git(config.localDir);
  const gitModulesPath = upath.join(config.localDir, fileName);

  const depNames = (
    (await git.raw([
      'config',
      '--file',
      gitModulesPath,
      '--get-regexp',
      'path',
    ])) || ''
  )
    .trim()
    .split(/[\n\s]/)
    .filter((_e: string, i: number) => i % 2);

  if (!depNames.length) {
    return null;
  }

  const deps = await Promise.all(
    depNames.map(async depName => {
      const currentValue = (await git.subModule(['status', depName])).split(
        /[+\s]/
      )[0];
      const submoduleBranch = await getBranch(gitModulesPath, depName);
      const subModuleUrl = await getUrl(gitModulesPath, depName);
      return {
        depName,
        registryUrls: [subModuleUrl, submoduleBranch],
        currentValue,
        currentDigest: currentValue,
      };
    })
  );

  return { deps, datasource: 'gitSubmodules' };
}

const getUrl = async (gitModulesPath: string, submoduleName: string) =>
  (await Git().raw([
    'config',
    '--file',
    gitModulesPath,
    '--get',
    `submodule.${submoduleName}.url`,
  ])).trim();

const getBranch = async (gitModulesPath: string, submoduleName: string) =>
  (
    (await Git().raw([
      'config',
      '--file',
      gitModulesPath,
      '--get',
      `submodule.${submoduleName}.branch`,
    ])) || 'master'
  ).trim();

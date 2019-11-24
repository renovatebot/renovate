import Git from 'simple-git/promise';
import upath from 'upath';
import URL from 'url';

import { ManagerConfig, PackageFile } from '../common';

async function getUrl(
  git: Git.SimpleGit,
  gitModulesPath: string,
  submoduleName: string
): Promise<string> {
  const path = (await Git().raw([
    'config',
    '--file',
    gitModulesPath,
    '--get',
    `submodule.${submoduleName}.url`,
  ])).trim();
  if (!path.startsWith('../')) {
    return path;
  }
  const remoteUrl = (await git.raw([
    'config',
    '--get',
    'remote.origin.url',
  ])).trim();
  return URL.resolve(`${remoteUrl}/`, path);
}

async function getBranch(
  gitModulesPath: string,
  submoduleName: string
): Promise<string> {
  return (
    (await Git().raw([
      'config',
      '--file',
      gitModulesPath,
      '--get',
      `submodule.${submoduleName}.branch`,
    ])) || 'master'
  ).trim();
}

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
      const currentValue = (await git.subModule(['status', depName]))
        .trim()
        .split(/[+\s]/)[0];
      const submoduleBranch = await getBranch(gitModulesPath, depName);
      const subModuleUrl = await getUrl(git, gitModulesPath, depName);
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

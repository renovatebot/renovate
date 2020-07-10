import URL from 'url';
import Git from 'simple-git/promise';
import upath from 'upath';

import * as datasourceGitSubmodules from '../../datasource/git-submodules';
import { logger } from '../../logger';
import { ManagerConfig, PackageFile } from '../common';

type GitModule = {
  name: string;
  path: string;
};

async function getUrl(
  git: Git.SimpleGit,
  gitModulesPath: string,
  submoduleName: string
): Promise<string> {
  const path = (
    await Git().raw([
      'config',
      '--file',
      gitModulesPath,
      '--get',
      `submodule.${submoduleName}.url`,
    ])
  )?.trim();
  if (!path?.startsWith('../')) {
    return path;
  }
  const remoteUrl = (
    await git.raw(['config', '--get', 'remote.origin.url'])
  ).trim();
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

async function getModules(
  git: Git.SimpleGit,
  gitModulesPath: string
): Promise<GitModule[]> {
  const res: GitModule[] = [];
  try {
    const modules = (
      (await git.raw([
        'config',
        '--file',
        gitModulesPath,
        '--get-regexp',
        'path',
      ])) ?? /* istanbul ignore next: should never happen */ ''
    )
      .trim()
      .split(/\n/)
      .filter((s) => !!s);

    for (const line of modules) {
      const [, name, path] = line.split(/submodule\.(.+?)\.path\s(.+)/);
      res.push({ name, path });
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error getting git submodules during extract');
  }
  return res;
}

export default async function extractPackageFile(
  _content: string,
  fileName: string,
  config: ManagerConfig
): Promise<PackageFile | null> {
  const git = Git(config.localDir);
  const gitModulesPath = upath.join(config.localDir, fileName);

  const depNames = await getModules(git, gitModulesPath);

  if (!depNames.length) {
    return null;
  }

  const deps = (
    await Promise.all(
      depNames.map(async ({ name, path }) => {
        try {
          const [currentValue] = (await git.subModule(['status', path]))
            .trim()
            .split(/[+\s]/);
          const submoduleBranch = await getBranch(gitModulesPath, name);
          const subModuleUrl = await getUrl(git, gitModulesPath, name);
          return {
            depName: path,
            registryUrls: [subModuleUrl, submoduleBranch],
            currentValue,
            currentDigest: currentValue,
          };
        } catch (err) /* istanbul ignore next */ {
          logger.warn(
            { err },
            'Error mapping git submodules during extraction'
          );
          return null;
        }
      })
    )
  ).filter(Boolean);

  return { deps, datasource: datasourceGitSubmodules.id };
}

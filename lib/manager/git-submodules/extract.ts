import URL from 'url';
import Git, { SimpleGit } from 'simple-git';
import upath from 'upath';

import * as datasourceGitSubmodules from '../../datasource/git-submodules';
import { logger } from '../../logger';
import { getHttpUrl } from '../../util/git';
import * as hostRules from '../../util/host-rules';
import { ManagerConfig, PackageFile } from '../common';

type GitModule = {
  name: string;
  path: string;
};

async function getUrl(
  git: SimpleGit,
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

const headRefRe = /ref: refs\/heads\/(?<branch>\w+)\s/;

async function getDefaultBranch(subModuleUrl: string): Promise<string> {
  const val = await Git().listRemote(['--symref', subModuleUrl, 'HEAD']);
  return headRefRe.exec(val)?.groups?.branch ?? 'master';
}

async function getBranch(
  gitModulesPath: string,
  submoduleName: string,
  subModuleUrl: string
): Promise<string> {
  return (
    (await Git().raw([
      'config',
      '--file',
      gitModulesPath,
      '--get',
      `submodule.${submoduleName}.branch`,
    ])) || (await getDefaultBranch(subModuleUrl))
  ).trim();
}

async function getModules(
  git: SimpleGit,
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
            .replace(/^[-+]/, '')
            .split(/\s/);
          const subModuleUrl = await getUrl(git, gitModulesPath, name);
          // hostRules only understands HTTP URLs
          // Find HTTP URL, then apply token
          let httpSubModuleUrl = getHttpUrl(subModuleUrl);
          const hostRule = hostRules.find({ url: httpSubModuleUrl });
          httpSubModuleUrl = getHttpUrl(subModuleUrl, hostRule?.token);
          const submoduleBranch = await getBranch(
            gitModulesPath,
            name,
            httpSubModuleUrl
          );
          return {
            depName: path,
            registryUrls: [httpSubModuleUrl, submoduleBranch],
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

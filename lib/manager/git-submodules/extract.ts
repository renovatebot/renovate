import URL from 'url';
import Git, { SimpleGit } from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { logger } from '../../logger';
import { simpleGitConfig } from '../../util/git/config';
import { getHttpUrl, getRemoteUrlWithToken } from '../../util/git/url';
import { regEx } from '../../util/regex';
import type { ExtractConfig, PackageFile } from '../types';
import { GitModule } from './types';

async function getUrl(
  git: SimpleGit,
  gitModulesPath: string,
  submoduleName: string
): Promise<string> {
  const path = (
    await Git(simpleGitConfig()).raw([
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

const headRefRe = regEx(/ref: refs\/heads\/(?<branch>\w+)\s/);

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
        '\\.path',
      ])) ?? /* istanbul ignore next: should never happen */ ''
    )
      .trim()
      .split(regEx(/\n/))
      .filter((s) => !!s);

    for (const line of modules) {
      const [, name, path] = line.split(regEx(/submodule\.(.+?)\.path\s(.+)/));
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
  config: ExtractConfig
): Promise<PackageFile | null> {
  const { localDir } = GlobalConfig.get();
  const git = Git(localDir);
  const gitModulesPath = upath.join(localDir, fileName);

  const depNames = await getModules(git, gitModulesPath);

  if (!depNames.length) {
    return null;
  }

  const deps = [];
  for (const { name, path } of depNames) {
    try {
      const [currentDigest] = (await git.subModule(['status', path]))
        .trim()
        .replace(regEx(/^[-+]/), '')
        .split(regEx(/\s/));
      const subModuleUrl = await getUrl(git, gitModulesPath, name);
      // hostRules only understands HTTP URLs
      // Find HTTP URL, then apply token
      let httpSubModuleUrl = getHttpUrl(subModuleUrl);
      httpSubModuleUrl = getRemoteUrlWithToken(httpSubModuleUrl);
      const currentValue = await getBranch(
        gitModulesPath,
        name,
        httpSubModuleUrl
      );
      deps.push({
        depName: path,
        lookupName: getHttpUrl(subModuleUrl),
        currentValue,
        currentDigest,
      });
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Error mapping git submodules during extraction');
    }
  }

  return { deps, datasource: GitRefsDatasource.id };
}

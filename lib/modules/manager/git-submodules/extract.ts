import URL from 'node:url';
import type { SimpleGit } from 'simple-git';
import Git from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { simpleGitConfig } from '../../../util/git/config';
import { getHttpUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import * as semVerVersioning from '../../versioning/semver';
import type { ExtractConfig, PackageFileContent } from '../types';
import type { GitModule } from './types';

async function getUrl(
  git: SimpleGit,
  gitModulesPath: string,
  submoduleName: string,
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

async function getBranch(
  git: SimpleGit,
  gitModulesPath: string,
  submoduleName: string,
): Promise<string | null> {
  const branchFromConfig = (
    await Git(simpleGitConfig()).raw([
      'config',
      '--file',
      gitModulesPath,
      '--get',
      `submodule.${submoduleName}.branch`,
    ])
  ).trim();

  return branchFromConfig === '.'
    ? (await git.branch(['--list'])).current.trim()
    : branchFromConfig || null;
}

async function getModules(
  git: SimpleGit,
  gitModulesPath: string,
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
  packageFile: string,
  _config: ExtractConfig,
): Promise<PackageFileContent | null> {
  const localDir = GlobalConfig.get('localDir');
  const git = Git(localDir, simpleGitConfig());
  const gitModulesPath = upath.join(localDir, packageFile);

  const depNames = await getModules(git, gitModulesPath);

  if (!depNames.length) {
    return null;
  }

  const deps = [];
  for (const { name, path } of depNames) {
    try {
      const [currentDigest] = (
        await git.subModule(['status', '--cached', path])
      )
        .trim()
        .replace(regEx(/^[-+]/), '')
        .split(regEx(/\s/));
      const subModuleUrl = await getUrl(git, gitModulesPath, name);
      const httpSubModuleUrl = getHttpUrl(subModuleUrl);
      const branch = await getBranch(git, gitModulesPath, name);
      deps.push({
        depName: path,
        packageName: httpSubModuleUrl,
        currentValue: branch ?? undefined,
        currentDigest,
        ...(semVerVersioning.api.isVersion(branch)
          ? { versioning: semVerVersioning.id }
          : {}),
      });
    } catch (err) /* istanbul ignore next */ {
      logger.warn(
        { err, packageFile },
        'Error mapping git submodules during extraction',
      );
    }
  }

  return { deps, datasource: GitRefsDatasource.id };
}

import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';
import type { PackageDependency, PackageFile } from '../types';
import { RE_REPOSITORY_GITHUB_SSH_FORMAT } from './constants';
import { parsePuppetfile } from './puppetfile-parser';
import type { PuppetfileModule } from './types';

function getForgeDependency(
  module: PuppetfileModule,
  forgeUrl?: string
): PackageDependency {
  const dep: PackageDependency = {
    depName: module.name,
    datasource: PuppetForgeDatasource.id,
    packageName: module.name,
    currentValue: module.version,
  };

  if (forgeUrl) {
    dep.registryUrls = [forgeUrl];
  }

  return dep;
}

function getGitDependency(module: PuppetfileModule): PackageDependency {
  const moduleName = module.name;

  const git = module.tags?.get('git');
  const tag = module.tags?.get('tag');

  if (git && tag) {
    const matchUrlSshFormat = RE_REPOSITORY_GITHUB_SSH_FORMAT.exec(git);

    let githubOwnerRepo;
    if (matchUrlSshFormat) {
      const githubOwner = matchUrlSshFormat[1];
      const githubRepo = matchUrlSshFormat[2];
      githubOwnerRepo = `${githubOwner}/${githubRepo}`;
    } else {
      githubOwnerRepo = git
        .replace(regEx(/^github:/), '')
        .replace(regEx(/^git\+/), '')
        .replace(regEx(/^https:\/\/github\.com\//), '')
        .replace(regEx(/\.git$/), '');
    }

    return {
      depName: moduleName,
      packageName: githubOwnerRepo,
      githubRepo: githubOwnerRepo,
      sourceUrl: git,
      gitRef: true,
      currentValue: tag,
      datasource: GithubTagsDatasource.id,
    };
  } else {
    return {
      depName: moduleName,
      gitRef: true,
      sourceUrl: git,
      skipReason: 'invalid-version',
    };
  }
}

function isGitModule(module: PuppetfileModule): boolean {
  return module.tags?.has('git');
}

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('puppet.extractPackageFile()');

  const puppetFile = parsePuppetfile(content);
  const deps: PackageDependency[] = [];

  for (const [forgeUrl, modules] of puppetFile.entries()) {
    for (const module of modules) {
      let packageDependency: PackageDependency;

      if(isGitModule(module)) {
        packageDependency = getGitDependency(module);
      } else {
        packageDependency = getForgeDependency(module, forgeUrl);
      }

      if(module.skipReason) {
        // the PuppetfileModule skip reason is dominant over the packageDependency skip reason
        packageDependency.skipReason = module.skipReason;
      }

      deps.push(packageDependency);
    }
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}

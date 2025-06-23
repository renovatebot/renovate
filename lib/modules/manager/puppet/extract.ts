import { logger } from '../../../logger';
import { parseUrl } from '../../../util/url';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';
import type { PackageDependency, PackageFileContent } from '../types';
import { isGithubUrl, parseGitOwnerRepo } from './common';
import { parsePuppetfile } from './puppetfile-parser';
import type { PuppetfileModule } from './types';

function parseForgeDependency(
  module: PuppetfileModule,
  forgeUrl: string | null,
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

function parseGitDependency(module: PuppetfileModule): PackageDependency {
  const moduleName = module.name;

  const git = module.tags?.get('git');
  const tag = module.tags?.get('tag');

  if (!git || !tag) {
    return {
      depName: moduleName,
      sourceUrl: git,
      skipReason: 'invalid-version',
    };
  }

  const parsedUrl = parseUrl(git);
  const githubUrl = isGithubUrl(git, parsedUrl);

  if (githubUrl && parsedUrl && parsedUrl.protocol !== 'https:') {
    logger.debug(
      `Access to github is only allowed for https, your url was: ${git}`,
    );
    return {
      depName: moduleName,
      sourceUrl: git,
      skipReason: 'invalid-url',
    };
  }
  const gitOwnerRepo = parseGitOwnerRepo(git, githubUrl);

  if (!gitOwnerRepo) {
    // failed to parse git url
    return {
      depName: moduleName,
      sourceUrl: git,
      skipReason: 'invalid-url',
    };
  }

  const packageDependency: PackageDependency = {
    depName: moduleName,
    packageName: git,
    sourceUrl: git,
    gitRef: true,
    currentValue: tag,
    datasource: GitTagsDatasource.id,
  };

  if (githubUrl) {
    packageDependency.packageName = gitOwnerRepo;
    packageDependency.datasource = GithubTagsDatasource.id;
  }

  return packageDependency;
}

function isGitModule(module: PuppetfileModule): boolean {
  return module.tags?.has('git') ?? false;
}

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace('puppet.extractPackageFile()');

  const puppetFile = parsePuppetfile(content);
  const deps: PackageDependency[] = [];

  for (const forgeUrl of puppetFile.getForges()) {
    for (const module of puppetFile.getModulesOfForge(forgeUrl)) {
      let packageDependency: PackageDependency;

      if (isGitModule(module)) {
        packageDependency = parseGitDependency(module);
      } else {
        packageDependency = parseForgeDependency(module, forgeUrl);
      }

      if (module.skipReason) {
        // the PuppetfileModule skip reason is dominant over the packageDependency skip reason
        packageDependency.skipReason = module.skipReason;
      }

      deps.push(packageDependency);
    }
  }

  return deps.length ? { deps } : null;
}

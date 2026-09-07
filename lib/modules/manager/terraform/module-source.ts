import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { TerraformModuleDatasource } from '../../datasource/terraform-module/index.ts';
import type { PackageDependency } from '../types.ts';
import type { ModuleSourceOptions } from './types.ts';

export const githubRefMatchRegex = regEx(
  /github\.com(?:[/:])(?<project>[^/]+\/[a-z0-9-_.]+).*\?(?:depth=\d+&)?ref=(?<tag>.*?)(?:&depth=\d+)?$/i,
);
export const bitbucketRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:http|https|ssh)?(?::\/\/)?(?:.*@)?(?<path>bitbucket\.org\/(?<workspace>.*)\/(?<project>.*)\.git\/?(?<subfolder>.*)))\?(?:depth=\d+&)?ref=(?<tag>.*?)(?:&depth=\d+)?$/,
);
export const gitTagsRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:(?:http|https|ssh):\/\/)?(?:.*@)?(?<path>[^:/]+[:/](?<project>[^/]+(?:\/[^/]+)*))(?:\.git)?)(?:(?:\/\/)?(?<subfolder>[^?]*))?\?(?:depth=\d+&)?ref=(?<tag>.*?)(?:&depth=\d+)?$/,
);
export const azureDevOpsSshRefMatchRegex = regEx(
  /(?:git::)?(?<url>git@ssh\.dev\.azure\.com:v3\/(?<organization>[^/]*)\/(?<project>[^/]*)\/(?<repository>[^/]*))(?<modulepath>.*)?\?(?:depth=\d+&)?ref=(?<tag>.*?)(?:&depth=\d+)?$/,
);

export const hostnameMatchRegex = regEx(
  /^(?<hostname>[a-zA-Z\d](?:[a-zA-Z\d-]*\.)+[a-zA-Z\d]+)/,
);

export function matchAzureDevOpsSshSource(
  dep: PackageDependency,
  source: string,
): boolean {
  const azureDevOpsSshRefMatch = azureDevOpsSshRefMatchRegex.exec(source);
  if (!azureDevOpsSshRefMatch?.groups) {
    return false;
  }

  const { organization, project, repository, modulepath, url, tag } =
    azureDevOpsSshRefMatch.groups;
  dep.depName = `${organization}/${project}/${repository}${modulepath}`;
  dep.packageName = url;
  dep.currentValue = tag;
  dep.datasource = GitTagsDatasource.id;
  return true;
}

/**
 * Terraform flavoured handling of non-GitHub Git module sources: Bitbucket
 * Cloud, Azure DevOps over SSH and any other Git remote.
 */
export function matchTerraformGitSource(
  dep: PackageDependency,
  source: string,
): boolean {
  const bitbucketRefMatch = bitbucketRefMatchRegex.exec(source);
  if (bitbucketRefMatch?.groups) {
    dep.depName = `${bitbucketRefMatch.groups.workspace}/${bitbucketRefMatch.groups.project}`;
    dep.packageName = dep.depName;
    dep.currentValue = bitbucketRefMatch.groups.tag;
    dep.datasource = BitbucketTagsDatasource.id;
    return true;
  }

  if (matchAzureDevOpsSshSource(dep, source)) {
    return true;
  }

  const gitTagsRefMatch = gitTagsRefMatchRegex.exec(source);
  if (gitTagsRefMatch?.groups) {
    if (gitTagsRefMatch.groups.subfolder) {
      logger.debug('Terraform module contains subdirectory');
    }
    dep.depName = gitTagsRefMatch.groups.path.replace(regEx(/\.git$/), '');
    dep.packageName = gitTagsRefMatch.groups.url.replace(regEx(/\.git$/), '');
    dep.currentValue = gitTagsRefMatch.groups.tag;
    dep.datasource = GitTagsDatasource.id;
    return true;
  }

  return false;
}

/**
 * Analyses a Terraform style module `source` address and fills in `dep`.
 *
 * GitHub refs, Terraform registry addresses, local paths and missing sources
 * are handled the same way for every manager. Everything else is delegated to
 * the manager specific `matchGitSource`.
 */
export function analyseModuleSource(
  dep: PackageDependency,
  source: string | undefined,
  opts: ModuleSourceOptions,
): void {
  if (!source) {
    logger.debug({ dep }, `${opts.manager} dep has no source`);
    dep.skipReason = 'no-source';
    return;
  }

  const githubRefMatch = githubRefMatchRegex.exec(source);
  if (githubRefMatch?.groups) {
    if (opts.depTypes) {
      dep.depType = opts.depTypes.github;
    }
    dep.packageName = githubRefMatch.groups.project.replace(
      regEx(/\.git$/),
      '',
    );
    dep.depName = `github.com/${dep.packageName}`;
    dep.currentValue = githubRefMatch.groups.tag;
    dep.datasource = GithubTagsDatasource.id;
    return;
  }

  if (opts.matchGitSource?.(dep, source)) {
    return;
  }

  const moduleParts = source.split('//')[0].split('/');
  if (moduleParts[0] === '.' || moduleParts[0] === '..') {
    dep.skipReason = 'local';
    return;
  }

  if (moduleParts.length >= 3) {
    const hostnameMatch = hostnameMatchRegex.exec(source);
    if (hostnameMatch?.groups) {
      dep.registryUrls = [`https://${hostnameMatch.groups.hostname}`];
    }
    if (opts.depTypes) {
      dep.depType = opts.depTypes.registry;
    }
    dep.depName = moduleParts.join('/');
    dep.datasource = TerraformModuleDatasource.id;
  }
}

import { logger } from '../../../logger';
import { detectPlatform } from '../../../util/common';
import { regEx } from '../../../util/regex';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';
import type { PackageDependency } from '../types';
import { extractTerragruntProvider } from './providers';
import type { ExtractionResult, TerraformManagerData } from './types';

export const githubRefMatchRegex = regEx(
  /github\.com([/:])(?<project>[^/]+\/[a-z0-9-_.]+).*\?(depth=\d+&)?ref=(?<tag>.*?)(&depth=\d+)?$/i,
);
export const gitTagsRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:http|https|ssh):\/\/(?:.*@)?(?<path>.*.*\/(?<project>.*\/.*)))\?(depth=\d+&)?ref=(?<tag>.*?)(&depth=\d+)?$/,
);
export const tfrVersionMatchRegex = regEx(
  /tfr:\/\/(?<registry>.*?)\/(?<org>[^/]+?)\/(?<name>[^/]+?)\/(?<cloud>[^/?]+).*\?(?:ref|version)=(?<currentValue>.*?)$/,
);
const hostnameMatchRegex = regEx(/^(?<hostname>([\w|\d]+\.)+[\w|\d]+)/);

export function extractTerragruntModule(
  startingLine: number,
  lines: string[],
): ExtractionResult {
  const moduleName = 'terragrunt';
  const result = extractTerragruntProvider(startingLine, lines, moduleName);
  result.dependencies.forEach((dep) => {
    // TODO #22198
    dep.managerData!.terragruntDependencyType = 'terraform';
  });
  return result;
}

function detectGitTagDatasource(registryUrl: string): string {
  const platform = detectPlatform(registryUrl);
  switch (platform) {
    case 'gitlab':
      return GitlabTagsDatasource.id;
    case 'bitbucket':
      return BitbucketTagsDatasource.id;
    case 'gitea':
      return GiteaTagsDatasource.id;
    default:
      return GitTagsDatasource.id;
  }
}

export function analyseTerragruntModule(
  dep: PackageDependency<TerraformManagerData>,
): void {
  // TODO #22198
  const source = dep.managerData!.source;
  const githubRefMatch = githubRefMatchRegex.exec(source ?? '');
  const gitTagsRefMatch = gitTagsRefMatchRegex.exec(source ?? '');
  const tfrVersionMatch = tfrVersionMatchRegex.exec(source ?? '');

  if (githubRefMatch?.groups) {
    dep.depType = 'github';
    dep.packageName = githubRefMatch.groups.project.replace(
      regEx(/\.git$/),
      '',
    );
    dep.depName = 'github.com/' + dep.packageName;
    dep.currentValue = githubRefMatch.groups.tag;
    dep.datasource = GithubTagsDatasource.id;
  } else if (gitTagsRefMatch?.groups) {
    dep.depType = 'gitTags';
    if (gitTagsRefMatch.groups.path.includes('//')) {
      logger.debug('Terragrunt module contains subdirectory');
      dep.depName = gitTagsRefMatch.groups.path.split('//')[0];
      const tempLookupName = gitTagsRefMatch.groups.url.split('//');
      dep.packageName = tempLookupName[0] + '//' + tempLookupName[1];
    } else {
      dep.depName = gitTagsRefMatch.groups.path.replace('.git', '');
      dep.packageName = gitTagsRefMatch.groups.url;
    }
    dep.currentValue = gitTagsRefMatch.groups.tag;
    dep.datasource = detectGitTagDatasource(gitTagsRefMatch.groups.url);
  } else if (tfrVersionMatch?.groups) {
    dep.depType = 'terragrunt';
    dep.depName =
      tfrVersionMatch.groups.org +
      '/' +
      tfrVersionMatch.groups.name +
      '/' +
      tfrVersionMatch.groups.cloud;
    dep.currentValue = tfrVersionMatch.groups.currentValue;
    dep.datasource = TerraformModuleDatasource.id;
    if (tfrVersionMatch.groups.registry) {
      dep.registryUrls = [`https://${tfrVersionMatch.groups.registry}`];
    }
  } else if (source) {
    const moduleParts = source.split('//')[0].split('/');
    if (moduleParts[0] === '..') {
      dep.skipReason = 'local';
    } else if (moduleParts.length >= 3) {
      const hostnameMatch = hostnameMatchRegex.exec(source);
      if (hostnameMatch?.groups) {
        dep.registryUrls = [`https://${hostnameMatch.groups.hostname}`];
      }
      dep.depType = 'terragrunt';
      dep.depName = moduleParts.join('/');
      dep.datasource = TerraformModuleDatasource.id;
    }
  } else {
    logger.debug({ dep }, 'terragrunt dep has no source');
    dep.skipReason = 'no-source';
  }
}

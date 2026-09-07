import { logger } from '../../../logger/index.ts';
import { detectPlatform } from '../../../util/common.ts';
import { regEx } from '../../../util/regex.ts';
import { parseUrl } from '../../../util/url.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { TerraformModuleDatasource } from '../../datasource/terraform-module/index.ts';
import {
  analyseModuleSource,
  matchAzureDevOpsSshSource,
} from '../terraform/module-source.ts';
import type { ExtractionResult } from '../terraform/types.ts';
import type { PackageDependency } from '../types.ts';
import { extractTerragruntProvider } from './providers.ts';
import type { TerraformManagerData } from './types.ts';

export const gitTagsRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:http|https|ssh):\/\/(?:.*@)?(?<host>[^/]*)\/(?<path>.*))\?(?:depth=\d+&)?ref=(?<tag>.*?)(?:&depth=\d+)?$/,
);
export const tfrVersionMatchRegex = regEx(
  /tfr:\/\/(?<registry>.*?)\/(?<org>[^/]+?)\/(?<name>[^/]+?)\/(?<cloud>[^/?]+).*\?(?:ref|version)=(?<currentValue>.*?)$/,
);

export function extractTerragruntModule(
  startingLine: number,
  lines: string[],
): ExtractionResult<TerraformManagerData> {
  const moduleName = 'terragrunt';
  return extractTerragruntProvider(startingLine, lines, moduleName);
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

function matchTerragruntGitSource(
  dep: PackageDependency,
  source: string,
): boolean {
  if (matchAzureDevOpsSshSource(dep, source)) {
    dep.depType = 'gitTags';
    return true;
  }

  const gitTagsRefMatch = gitTagsRefMatchRegex.exec(source);
  if (!gitTagsRefMatch?.groups) {
    return false;
  }

  const { url, tag } = gitTagsRefMatch.groups;
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    logger.debug({ url }, 'Terragrunt module has invalid URL, skipping');
    dep.skipReason = 'invalid-url';
    return true;
  }

  const { hostname, host, pathname, protocol } = parsedUrl;
  const containsSubDirectory = pathname.includes('//');
  if (containsSubDirectory) {
    logger.debug('Terragrunt module contains subdirectory');
  }
  dep.depType = 'gitTags';
  // We don't want to have leading slash, .git or subdirectory in the repository path
  const repositoryPath = pathname
    .replace(regEx(/^\//), '')
    .split('//')[0]
    .replace(regEx('.git$'), '');
  dep.depName = `${hostname}/${repositoryPath}`;
  dep.currentValue = tag;
  dep.datasource = detectGitTagDatasource(url);
  if (dep.datasource === GitTagsDatasource.id) {
    if (containsSubDirectory) {
      const tempLookupName = url.split('//');
      dep.packageName = `${tempLookupName[0]}//${tempLookupName[1]}`;
    } else {
      dep.packageName = url;
    }
  } else {
    // The packageName should only contain the path to the repository
    dep.packageName = repositoryPath;
    dep.registryUrls = [
      protocol === 'https:' ? `https://${host}` : `https://${hostname}`,
    ];
  }
  return true;
}

export function analyseTerragruntModule(
  dep: PackageDependency<TerraformManagerData>,
): void {
  // TODO #22198
  const source = dep.managerData!.source;

  // `tfr://` is Terragrunt specific and cannot match any of the shared sources
  const tfrVersionMatch = tfrVersionMatchRegex.exec(source ?? '');
  if (tfrVersionMatch?.groups) {
    dep.depType = 'terragrunt';
    dep.depName = `${tfrVersionMatch.groups.org}/${tfrVersionMatch.groups.name}/${tfrVersionMatch.groups.cloud}`;
    dep.currentValue = tfrVersionMatch.groups.currentValue;
    dep.datasource = TerraformModuleDatasource.id;
    if (tfrVersionMatch.groups.registry) {
      dep.registryUrls = [`https://${tfrVersionMatch.groups.registry}`];
    }
    return;
  }

  analyseModuleSource(dep, source, {
    manager: 'terragrunt',
    depTypes: { github: 'github', registry: 'terragrunt' },
    matchGitSource: matchTerragruntGitSource,
  });
}

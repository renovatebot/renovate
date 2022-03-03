import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';
import type { PackageDependency } from '../types';
import { TerragruntDependencyTypes } from './common';
import { extractTerragruntProvider } from './providers';
import type { ExtractionResult } from './types';

export const githubRefMatchRegex = regEx(
  /github\.com([/:])(?<project>[^/]+\/[a-z0-9-_.]+).*\?ref=(?<tag>.*)$/i
);
export const gitTagsRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:http|https|ssh):\/\/(?:.*@)?(?<path>.*.*\/(?<project>.*\/.*)))\?ref=(?<tag>.*)$/
);
const hostnameMatchRegex = regEx(/^(?<hostname>([\w|\d]+\.)+[\w|\d]+)/);

export function extractTerragruntModule(
  startingLine: number,
  lines: string[]
): ExtractionResult {
  const moduleName = 'terragrunt';
  const result = extractTerragruntProvider(startingLine, lines, moduleName);
  result.dependencies.forEach((dep) => {
    dep.managerData.terragruntDependencyType =
      TerragruntDependencyTypes.terragrunt;
  });
  return result;
}

export function analyseTerragruntModule(dep: PackageDependency): void {
  const githubRefMatch = githubRefMatchRegex.exec(dep.managerData.source);
  const gitTagsRefMatch = gitTagsRefMatchRegex.exec(dep.managerData.source);

  if (githubRefMatch) {
    dep.depType = 'github';
    dep.lookupName = githubRefMatch.groups.project.replace(regEx(/\.git$/), '');
    dep.depName = 'github.com/' + dep.lookupName;
    dep.currentValue = githubRefMatch.groups.tag;
    dep.datasource = GithubTagsDatasource.id;
  } else if (gitTagsRefMatch) {
    dep.depType = 'gitTags';
    if (gitTagsRefMatch.groups.path.includes('//')) {
      logger.debug('Terragrunt module contains subdirectory');
      dep.depName = gitTagsRefMatch.groups.path.split('//')[0];
      const tempLookupName = gitTagsRefMatch.groups.url.split('//');
      dep.lookupName = tempLookupName[0] + '//' + tempLookupName[1];
    } else {
      dep.depName = gitTagsRefMatch.groups.path.replace('.git', '');
      dep.lookupName = gitTagsRefMatch.groups.url;
    }
    dep.currentValue = gitTagsRefMatch.groups.tag;
    dep.datasource = GitTagsDatasource.id;
  } else if (dep.managerData.source) {
    const moduleParts = dep.managerData.source.split('//')[0].split('/');
    if (moduleParts[0] === '..') {
      dep.skipReason = 'local';
    } else if (moduleParts.length >= 3) {
      const hostnameMatch = hostnameMatchRegex.exec(dep.managerData.source);
      if (hostnameMatch) {
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

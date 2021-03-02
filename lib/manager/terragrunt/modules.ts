import * as datasourceGitTags from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
import * as datasourceTerragruntModule from '../../datasource/terraform-module';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import type { PackageDependency } from '../types';
import { extractTerragruntProvider } from './providers';
import { ExtractionResult, TerragruntDependencyTypes } from './util';

const githubRefMatchRegex = /github.com([/:])(?<project>[^/]+\/[a-z0-9-.]+).*\?ref=(?<tag>.*)$/;
const gitTagsRefMatchRegex = /(?:git::)?(?<url>(?:http|https|ssh):\/\/(?:.*@)?(?<path>.*.*\/(?<project>.*\/.*)))\?ref=(?<tag>.*)$/;
const hostnameMatchRegex = /^(?<hostname>([\w|\d]+\.)+[\w|\d]+)/;

export function extractTerragruntModule(
  startingLine: number,
  lines: string[]
): ExtractionResult {
  const moduleName = 'terragrunt';
  const result = extractTerragruntProvider(startingLine, lines, moduleName);
  result.dependencies.forEach((dep) => {
    // eslint-disable-next-line no-param-reassign
    dep.managerData.terragruntDependencyType =
      TerragruntDependencyTypes.terragrunt;
  });
  return result;
}

export function analyseTerragruntModule(dep: PackageDependency): void {
  const githubRefMatch = githubRefMatchRegex.exec(dep.managerData.source);
  const gitTagsRefMatch = gitTagsRefMatchRegex.exec(dep.managerData.source);
  /* eslint-disable no-param-reassign */
  if (githubRefMatch) {
    dep.depType = 'github';
    dep.lookupName = githubRefMatch.groups.project.replace(/\.git$/, '');
    dep.depName = 'github.com/' + dep.lookupName;
    dep.currentValue = githubRefMatch.groups.tag;
    dep.datasource = datasourceGithubTags.id;
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
    dep.datasource = datasourceGitTags.id;
  } else if (dep.managerData.source) {
    const moduleParts = dep.managerData.source.split('//')[0].split('/');
    if (moduleParts[0] === '..') {
      dep.skipReason = SkipReason.Local;
    } else if (moduleParts.length >= 3) {
      const hostnameMatch = hostnameMatchRegex.exec(dep.managerData.source);
      if (hostnameMatch) {
        dep.registryUrls = [`https://${hostnameMatch.groups.hostname}`];
      }
      dep.depType = 'terragrunt';
      dep.depName = moduleParts.join('/');
      dep.datasource = datasourceTerragruntModule.id;
    }
  } else {
    logger.debug({ dep }, 'terragrunt dep has no source');
    dep.skipReason = SkipReason.NoSource;
  }
  /* eslint-enable no-param-reassign */
}

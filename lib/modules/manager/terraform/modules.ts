import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { BitBucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { TerraformModuleDatasource } from '../../datasource/terraform-module';
import type { PackageDependency } from '../types';
import { TerraformDependencyTypes } from './common';
import { extractTerraformProvider } from './providers';
import type { ExtractionResult } from './types';

export const githubRefMatchRegex = regEx(
  /github\.com([/:])(?<project>[^/]+\/[a-z0-9-_.]+).*\?ref=(?<tag>.*)$/i
);
export const bitbucketRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:http|https|ssh)?(?::\/\/)?(?:.*@)?(?<path>bitbucket\.org\/(?<workspace>.*)\/(?<project>.*).git\/?(?<subfolder>.*)))\?ref=(?<tag>.*)$/
);
export const gitTagsRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:http|https|ssh):\/\/(?:.*@)?(?<path>.*.*\/(?<project>.*\/.*)))\?ref=(?<tag>.*)$/
);
const hostnameMatchRegex = regEx(/^(?<hostname>([\w|\d]+\.)+[\w|\d]+)/);

export function extractTerraformModule(
  startingLine: number,
  lines: string[],
  moduleName: string
): ExtractionResult {
  const result = extractTerraformProvider(startingLine, lines, moduleName);
  result.dependencies.forEach((dep) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    dep.managerData!.terraformDependencyType = TerraformDependencyTypes.module;
  });
  return result;
}

export function analyseTerraformModule(dep: PackageDependency): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const source = dep.managerData!.source as string;
  const githubRefMatch = githubRefMatchRegex.exec(source);
  const bitbucketRefMatch = bitbucketRefMatchRegex.exec(source);
  const gitTagsRefMatch = gitTagsRefMatchRegex.exec(source);

  if (githubRefMatch?.groups) {
    dep.packageName = githubRefMatch.groups.project.replace(
      regEx(/\.git$/),
      ''
    );
    dep.depType = 'module';
    dep.depName = 'github.com/' + dep.packageName;
    dep.currentValue = githubRefMatch.groups.tag;
    dep.datasource = GithubTagsDatasource.id;
  } else if (bitbucketRefMatch?.groups) {
    dep.depType = 'module';
    dep.depName =
      bitbucketRefMatch.groups.workspace +
      '/' +
      bitbucketRefMatch.groups.project;
    dep.packageName = dep.depName;
    dep.currentValue = bitbucketRefMatch.groups.tag;
    dep.datasource = BitBucketTagsDatasource.id;
  } else if (gitTagsRefMatch?.groups) {
    dep.depType = 'module';
    if (gitTagsRefMatch.groups.path.includes('//')) {
      logger.debug('Terraform module contains subdirectory');
      dep.depName = gitTagsRefMatch.groups.path.split('//')[0];
      const tempLookupName = gitTagsRefMatch.groups.url.split('//');
      dep.packageName = tempLookupName[0] + '//' + tempLookupName[1];
    } else {
      dep.depName = gitTagsRefMatch.groups.path.replace('.git', '');
      dep.packageName = gitTagsRefMatch.groups.url;
    }
    dep.currentValue = gitTagsRefMatch.groups.tag;
    dep.datasource = GitTagsDatasource.id;
  } else if (source) {
    const moduleParts = source.split('//')[0].split('/');
    if (moduleParts[0] === '..') {
      dep.skipReason = 'local';
    } else if (moduleParts.length >= 3) {
      const hostnameMatch = hostnameMatchRegex.exec(source);
      if (hostnameMatch?.groups) {
        dep.registryUrls = [`https://${hostnameMatch.groups.hostname}`];
      }
      dep.depType = 'module';
      dep.depName = moduleParts.join('/');
      dep.datasource = TerraformModuleDatasource.id;
    }
  } else {
    logger.debug({ dep }, 'terraform dep has no source');
    dep.skipReason = 'no-source';
  }
}

import * as datasourceGitTags from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
import * as datasourceTerraformModule from '../../datasource/terraform-module';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { isVersion } from '../../versioning/hashicorp';
import { PackageDependency } from '../common';
import { extractTerraformProvider } from './provider';
import {
  ExtractionResult,
  TerraformDependencyTypes,
  gitTagsRefMatchRegex,
  githubRefMatchRegex,
} from './util';

export function extractTerraformModule(
  startingLine: number,
  lines: string[],
  moduleName: string
): ExtractionResult {
  const result = extractTerraformProvider(startingLine, lines, moduleName);
  result.dependencies.forEach((dep) => {
    // eslint-disable-next-line no-param-reassign
    dep.managerData.terraformDependencyType = TerraformDependencyTypes.module;
  });
  return result;
}

export function analyseTerraformModule(dep: PackageDependency): void {
  const githubRefMatch = githubRefMatchRegex.exec(dep.managerData.source);
  const gitTagsRefMatch = gitTagsRefMatchRegex.exec(dep.managerData.source);
  /* eslint-disable no-param-reassign */
  if (githubRefMatch) {
    const depNameShort = githubRefMatch[2].replace(/\.git$/, '');
    dep.depType = 'github';
    dep.depName = 'github.com/' + depNameShort;
    dep.depNameShort = depNameShort;
    dep.currentValue = githubRefMatch[3];
    dep.datasource = datasourceGithubTags.id;
    dep.lookupName = depNameShort;
    if (!isVersion(dep.currentValue)) {
      dep.skipReason = SkipReason.UnsupportedVersion;
    }
  } else if (gitTagsRefMatch) {
    dep.depType = 'gitTags';
    if (gitTagsRefMatch[2].includes('//')) {
      logger.debug('Terraform module contains subdirectory');
      dep.depName = gitTagsRefMatch[2].split('//')[0];
      dep.depNameShort = dep.depName.split(/\/(.+)/)[1];
      const tempLookupName = gitTagsRefMatch[1].split('//');
      dep.lookupName = tempLookupName[0] + '//' + tempLookupName[1];
    } else {
      dep.depName = gitTagsRefMatch[2].replace('.git', '');
      dep.depNameShort = gitTagsRefMatch[3].replace('.git', '');
      dep.lookupName = gitTagsRefMatch[1];
    }
    dep.currentValue = gitTagsRefMatch[4];
    dep.datasource = datasourceGitTags.id;
    if (!isVersion(dep.currentValue)) {
      dep.skipReason = SkipReason.UnsupportedVersion;
    }
  } else if (dep.managerData.source) {
    const moduleParts = dep.managerData.source.split('//')[0].split('/');
    if (moduleParts[0] === '..') {
      dep.skipReason = SkipReason.Local;
    } else if (moduleParts.length >= 3) {
      dep.depType = 'terraform';
      dep.depName = moduleParts.join('/');
      dep.depNameShort = dep.depName;
      dep.datasource = datasourceTerraformModule.id;
    }
  } else {
    logger.debug({ dep }, 'terraform dep has no source');
    dep.skipReason = SkipReason.NoSource;
  }
}

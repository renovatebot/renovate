import is from '@sindresorhus/is';
import { logger } from '../../../../../logger';
import { regEx } from '../../../../../util/regex';
import { BitbucketTagsDatasource } from '../../../../datasource/bitbucket-tags';
import { GitTagsDatasource } from '../../../../datasource/git-tags';
import { GithubTagsDatasource } from '../../../../datasource/github-tags';
import { TerraformModuleDatasource } from '../../../../datasource/terraform-module';
import type { PackageDependency } from '../../../types';
import { DependencyExtractor } from '../../base';
import type { TerraformDefinitionFile } from '../../hcl/types';

export const githubRefMatchRegex = regEx(
  /github\.com([/:])(?<project>[^/]+\/[a-z0-9-_.]+).*\?(depth=\d+&)?ref=(?<tag>.*?)(&depth=\d+)?$/i,
);
export const bitbucketRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:http|https|ssh)?(?::\/\/)?(?:.*@)?(?<path>bitbucket\.org\/(?<workspace>.*)\/(?<project>.*).git\/?(?<subfolder>.*)))\?(depth=\d+&)?ref=(?<tag>.*?)(&depth=\d+)?$/,
);
export const gitTagsRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:(?:http|https|ssh):\/\/)?(?:.*@)?(?<path>.*\/(?<project>.*\/.*)))\?(depth=\d+&)?ref=(?<tag>.*?)(&depth=\d+)?$/,
);
export const azureDevOpsSshRefMatchRegex = regEx(
  /(?:git::)?(?<url>git@ssh\.dev\.azure\.com:v3\/(?<organization>[^/]*)\/(?<project>[^/]*)\/(?<repository>[^/]*))(?<modulepath>.*)?\?(depth=\d+&)?ref=(?<tag>.*?)(&depth=\d+)?$/,
);
const hostnameMatchRegex = regEx(/^(?<hostname>([\w|\d]+\.)+[\w|\d]+)/);

export class ModuleExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return ['module'];
  }

  extract(hclRoot: TerraformDefinitionFile): PackageDependency[] {
    const modules = hclRoot.module;
    if (is.nullOrUndefined(modules)) {
      return [];
    }

    // istanbul ignore if
    if (!is.plainObject(modules)) {
      logger.debug({ modules }, 'Terraform: unexpected `modules` value');
      return [];
    }

    const dependencies = [];
    for (const [depName, moduleElements] of Object.entries(modules)) {
      for (const moduleElement of moduleElements) {
        const dep = {
          depName,
          depType: 'module',
          currentValue: moduleElement.version,
          managerData: {
            source: moduleElement.source,
          },
        };
        dependencies.push(this.analyseTerraformModule(dep));
      }
    }

    return dependencies;
  }

  private analyseTerraformModule(dep: PackageDependency): PackageDependency {
    // TODO #22198
    const source = dep.managerData!.source as string;
    const githubRefMatch = githubRefMatchRegex.exec(source);
    const bitbucketRefMatch = bitbucketRefMatchRegex.exec(source);
    const gitTagsRefMatch = gitTagsRefMatchRegex.exec(source);
    const azureDevOpsSshRefMatch = azureDevOpsSshRefMatchRegex.exec(source);

    if (githubRefMatch?.groups) {
      dep.packageName = githubRefMatch.groups.project.replace(
        regEx(/\.git$/),
        '',
      );
      dep.depName = 'github.com/' + dep.packageName;
      dep.currentValue = githubRefMatch.groups.tag;
      dep.datasource = GithubTagsDatasource.id;
    } else if (bitbucketRefMatch?.groups) {
      dep.depName =
        bitbucketRefMatch.groups.workspace +
        '/' +
        bitbucketRefMatch.groups.project;
      dep.packageName = dep.depName;
      dep.currentValue = bitbucketRefMatch.groups.tag;
      dep.datasource = BitbucketTagsDatasource.id;
    } else if (azureDevOpsSshRefMatch?.groups) {
      dep.depName = `${azureDevOpsSshRefMatch.groups.organization}/${azureDevOpsSshRefMatch.groups.project}/${azureDevOpsSshRefMatch.groups.repository}${azureDevOpsSshRefMatch.groups.modulepath}`;
      dep.packageName = azureDevOpsSshRefMatch.groups.url;
      dep.currentValue = azureDevOpsSshRefMatch.groups.tag;
      dep.datasource = GitTagsDatasource.id;
    } else if (gitTagsRefMatch?.groups) {
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
      if (moduleParts[0] === '.' || moduleParts[0] === '..') {
        dep.skipReason = 'local';
      } else if (moduleParts.length >= 3) {
        const hostnameMatch = hostnameMatchRegex.exec(source);
        if (hostnameMatch?.groups) {
          dep.registryUrls = [`https://${hostnameMatch.groups.hostname}`];
        }
        dep.depName = moduleParts.join('/');
        dep.datasource = TerraformModuleDatasource.id;
      }
    } else {
      logger.debug({ dep }, 'terraform dep has no source');
      dep.skipReason = 'no-source';
    }

    return dep;
  }
}

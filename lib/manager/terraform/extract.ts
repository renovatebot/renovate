import * as datasourceGitTags from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
import * as datasourceTerraformModule from '../../datasource/terraform-module';
import * as datasourceTerraformProvider from '../../datasource/terraform-provider';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { isValid, isVersion } from '../../versioning/hashicorp';
import { PackageDependency, PackageFile } from '../common';

export enum TerraformDependencyTypes {
  unknown = 'unknown',
  module = 'module',
  provider = 'provider',
  required_providers = 'required_providers',
}

export function getTerraformDependencyType(
  value: string
): TerraformDependencyTypes {
  switch (value) {
    case 'module': {
      return TerraformDependencyTypes.module;
    }
    case 'provider': {
      return TerraformDependencyTypes.provider;
    }
    case 'required_providers': {
      return TerraformDependencyTypes.required_providers;
    }
    default: {
      return TerraformDependencyTypes.unknown;
    }
  }
}

const dependencyBlockExtractionRegex = /^\s*(?<type>module|provider|required_providers)\s+("(?<lookupName>[^"]+)"\s+)?{\s*$/;
const keyValueExtractionRegex = /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/; // extracts `exampleKey = exampleValue`

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace({ content }, 'terraform.extractPackageFile()');
  if (
    !content.includes('module "') &&
    !content.includes('provider "') &&
    !content.includes('required_providers ')
  ) {
    return null;
  }
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      let line = lines[lineNumber];
      const terraformDependency = dependencyBlockExtractionRegex.exec(line);
      if (terraformDependency) {
        logger.trace(
          `Matched ${terraformDependency.groups.type} on line ${lineNumber}`
        );
        const tfDepType = getTerraformDependencyType(
          terraformDependency.groups.type
        );

        if (tfDepType === TerraformDependencyTypes.unknown) {
          /* istanbul ignore next */ logger.warn(
            `Could not identify TerraformDependencyType ${terraformDependency.groups.type} on line ${lineNumber}.`
          );
        } else if (tfDepType === TerraformDependencyTypes.required_providers) {
          do {
            const dep: PackageDependency = {
              managerData: {
                terraformDependencyType: tfDepType,
              },
            };

            lineNumber += 1;
            line = lines[lineNumber];
            const kvMatch = keyValueExtractionRegex.exec(line);
            if (kvMatch) {
              dep.currentValue = kvMatch.groups.value;
              dep.managerData.moduleName = kvMatch.groups.key;
              dep.managerData.versionLine = lineNumber;
              deps.push(dep);
            }
          } while (line.trim() !== '}');
        } else {
          const dep: PackageDependency = {
            managerData: {
              moduleName: terraformDependency.groups.lookupName,
              terraformDependencyType: tfDepType,
            },
          };
          do {
            lineNumber += 1;
            line = lines[lineNumber];
            const kvMatch = keyValueExtractionRegex.exec(line);
            if (kvMatch) {
              if (kvMatch.groups.key === 'version') {
                dep.currentValue = kvMatch.groups.value;
                dep.managerData.versionLine = lineNumber;
              } else if (kvMatch.groups.key === 'source') {
                dep.managerData.source = kvMatch.groups.value;
                dep.managerData.sourceLine = lineNumber;
              }
            }
          } while (line.trim() !== '}');
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting buildkite plugins');
  }
  deps.forEach((dep) => {
    if (
      dep.managerData.terraformDependencyType ===
      TerraformDependencyTypes.module
    ) {
      const githubRefMatch = /github.com(\/|:)([^/]+\/[a-z0-9-.]+).*\?ref=(.*)$/.exec(
        dep.managerData.source
      );
      const gitTagsRefMatch = /git::((?:http|https|ssh):\/\/(?:.*@)?(.*.*\/(.*\/.*)))\?ref=(.*)$/.exec(
        dep.managerData.source
      );
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
    } else if (
      dep.managerData.terraformDependencyType ===
        TerraformDependencyTypes.provider ||
      dep.managerData.terraformDependencyType ===
        TerraformDependencyTypes.required_providers
    ) {
      dep.depType = 'terraform';
      dep.depName = dep.managerData.moduleName;
      dep.depNameShort = dep.managerData.moduleName;
      dep.datasource = datasourceTerraformProvider.id;
      if (!isValid(dep.currentValue)) {
        dep.skipReason = SkipReason.UnsupportedVersion;
      }
    }
    delete dep.managerData;
    /* eslint-enable no-param-reassign */
  });
  if (deps.some((dep) => dep.skipReason !== 'local')) {
    return { deps };
  }
  return null;
}

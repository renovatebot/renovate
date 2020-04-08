import { logger } from '../../logger';
import { isValid, isVersion } from '../../versioning/hashicorp';
import { PackageDependency, PackageFile } from '../common';
import * as datasourceGitTags from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
import * as datasourceTerraformModule from '../../datasource/terraform-module';
import * as datasourceTerraformProvider from '../../datasource/terraform-provider';
import { SkipReason } from '../../types';

export enum TerraformDependencyTypes {
  unknown = 'unknown',
  module = 'module',
  provider = 'provider',
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
    default: {
      return TerraformDependencyTypes.unknown;
    }
  }
}

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace({ content }, 'terraform.extractPackageFile()');
  if (!content.includes('module "') && !content.includes('provider "')) {
    return null;
  }
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      let line = lines[lineNumber];
      const terraformDependency = /^(module|provider)\s+"([^"]+)"\s+{\s*$/.exec(
        line
      );
      if (terraformDependency) {
        logger.trace(`Matched ${terraformDependency[1]} on line ${lineNumber}`);
        const tfDepType: TerraformDependencyTypes = getTerraformDependencyType(
          terraformDependency[1]
        );
        const dep: PackageDependency = {
          managerData: {
            moduleName: terraformDependency[2],
            terraformDependencyType: tfDepType,
          },
        };
        if (tfDepType === TerraformDependencyTypes.unknown) {
          /* istanbul ignore next */ logger.trace(
            `Could not identify TerraformDependencyType ${terraformDependency[1]} on line ${lineNumber}.`
          );
        } else {
          do {
            lineNumber += 1;
            line = lines[lineNumber];
            const kvMatch = /^\s*([^\s]+)\s+=\s+"([^"]+)"\s*$/.exec(line);
            if (kvMatch) {
              const [, key, value] = kvMatch;
              if (key === 'version') {
                dep.currentValue = value;
                dep.managerData.versionLine = lineNumber;
              } else if (key === 'source') {
                dep.managerData.source = value;
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
  deps.forEach(dep => {
    if (
      dep.managerData.terraformDependencyType ===
      TerraformDependencyTypes.module
    ) {
      const githubRefMatch = /github.com(\/|:)([^/]+\/[a-z0-9-]+).*\?ref=(.*)$/.exec(
        dep.managerData.source
      );
      // Regex would need to be updated to support ssh://
      const gitTagsRefMatch = /git::(http|https:\/\/(.*.*\/(.*\/.*)))(?:|\/\/.*)\?ref=(.*)$/.exec(
        dep.managerData.source
      );
      /* eslint-disable no-param-reassign */
      if (githubRefMatch) {
        dep.depType = 'github';
        dep.depName = 'github.com/' + githubRefMatch[2];
        dep.depNameShort = githubRefMatch[2];
        dep.currentValue = githubRefMatch[3];
        dep.datasource = datasourceGithubTags.id;
        dep.lookupName = githubRefMatch[2];
        dep.managerData.lineNumber = dep.managerData.sourceLine;
        if (!isVersion(dep.currentValue)) {
          dep.skipReason = SkipReason.UnsupportedVersion;
        }
      } else if (gitTagsRefMatch) {
        dep.depType = 'gitTags';
        dep.depName = gitTagsRefMatch[2].replace('.git', '');
        dep.depNameShort = gitTagsRefMatch[3].replace('.git', '');
        dep.currentValue = gitTagsRefMatch[4];
        dep.datasource = datasourceGitTags.id;
        dep.lookupName = gitTagsRefMatch[1];
        dep.managerData.lineNumber = dep.managerData.sourceLine;
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
          dep.managerData.lineNumber = dep.managerData.versionLine;
          dep.datasource = datasourceTerraformModule.id;
        }
      } else {
        logger.debug({ dep }, 'terraform dep has no source');
        dep.skipReason = SkipReason.NoSource;
      }
    } else if (
      dep.managerData.terraformDependencyType ===
      TerraformDependencyTypes.provider
    ) {
      dep.depType = 'terraform';
      dep.depName = dep.managerData.moduleName;
      dep.depNameShort = dep.managerData.moduleName;
      dep.managerData.lineNumber = dep.managerData.versionLine;
      dep.datasource = datasourceTerraformProvider.id;
      if (dep.managerData.lineNumber) {
        if (!isValid(dep.currentValue)) {
          dep.skipReason = SkipReason.UnsupportedVersion;
        }
      } else if (!dep.skipReason) {
        dep.skipReason = SkipReason.NoVersion;
      }
    }
    delete dep.managerData;
    /* eslint-enable no-param-reassign */
  });
  if (deps.some(dep => dep.skipReason !== 'local')) {
    return { deps };
  }
  return null;
}

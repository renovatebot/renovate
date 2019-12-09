import { logger } from '../../logger';
import { isValid, isVersion } from '../../versioning/hashicorp';
import { PackageDependency, PackageFile } from '../common';

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
      const terraformDependency = line.match(
        /^(module|provider)\s+"([^"]+)"\s+{\s*$/
      );
      if (terraformDependency) {
        logger.trace(`Matched ${terraformDependency[1]} on line ${lineNumber}`);
        const tfDepType: TerraformDependencyTypes = getTerraformDependencyType(
          terraformDependency[1]
        );
        const dep: PackageDependency = {
          moduleName: terraformDependency[2],
          managerData: {
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
            const kvMatch = line.match(/^\s*([^\s]+)\s+=\s+"([^"]+)"\s*$/);
            if (kvMatch) {
              const [, key, value] = kvMatch;
              if (key === 'version') {
                dep.currentValue = value;
                dep.versionLine = lineNumber;
              } else if (key === 'source') {
                dep.source = value;
                dep.sourceLine = lineNumber;
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
      const githubRefMatch =
        dep.source &&
        dep.source.match(/github.com(\/|:)([^/]+\/[a-z0-9-]+).*\?ref=(.*)$/);
      /* eslint-disable no-param-reassign */
      if (githubRefMatch) {
        dep.depType = 'github';
        dep.depName = 'github.com/' + githubRefMatch[2];
        dep.depNameShort = githubRefMatch[2];
        dep.currentValue = githubRefMatch[3];
        dep.datasource = 'github';
        dep.lookupName = githubRefMatch[2];
        dep.managerData.lineNumber = dep.sourceLine;
        if (!isVersion(dep.currentValue)) {
          dep.skipReason = 'unsupported-version';
        }
      } else if (dep.source) {
        const moduleParts = dep.source.split('//')[0].split('/');
        if (moduleParts[0] === '..') {
          dep.skipReason = 'local';
        } else if (moduleParts.length >= 3) {
          dep.depType = 'terraform';
          dep.depName = moduleParts.join('/');
          dep.depNameShort = dep.depName;
          dep.managerData.lineNumber = dep.versionLine;
          dep.datasource = 'terraform';
        }
        if (dep.managerData.lineNumber) {
          if (!isValid(dep.currentValue)) {
            dep.skipReason = 'unsupported-version';
          }
        } else if (!dep.skipReason) {
          dep.skipReason = 'no-version';
        }
      } else {
        logger.info({ dep }, 'terraform dep has no source');
        dep.skipReason = 'no-source';
      }
    } else if (
      dep.managerData.terraformDependencyType ===
      TerraformDependencyTypes.provider
    ) {
      dep.depType = 'terraform';
      dep.depName = dep.moduleName;
      dep.depNameShort = dep.moduleName;
      dep.managerData.lineNumber = dep.versionLine;
      dep.datasource = 'terraformProvider';
      if (dep.managerData.lineNumber) {
        if (!isValid(dep.currentValue)) {
          dep.skipReason = 'unsupported-version';
        }
      } else if (!dep.skipReason) {
        dep.skipReason = 'no-version';
      }
    }
    delete dep.sourceLine;
    delete dep.versionLine;
    /* eslint-enable no-param-reassign */
  });
  if (deps.some(dep => dep.skipReason !== 'local')) {
    return { deps };
  }
  return null;
}

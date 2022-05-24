import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { TerraformDependencyTypes } from './common';
import type { ProviderLock } from './lockfile/types';
import { extractLocks, findLockFile, readLockFile } from './lockfile/util';
import { analyseTerraformModule, extractTerraformModule } from './modules';
import {
  analyzeTerraformProvider,
  extractTerraformProvider,
} from './providers';
import {
  analyzeTerraformRequiredProvider,
  extractTerraformRequiredProviders,
} from './required-providers';
import {
  analyseTerraformVersion,
  extractTerraformRequiredVersion,
} from './required-version';
import {
  analyseTerraformResource,
  extractTerraformResource,
} from './resources';
import type { ExtractionResult, TerraformManagerData } from './types';
import {
  checkFileContainsDependency,
  getTerraformDependencyType,
} from './util';

const dependencyBlockExtractionRegex = regEx(
  /^\s*(?<type>[a-z_]+)\s+("(?<packageName>[^"]+)"\s+)?("(?<terraformName>[^"]+)"\s+)?{\s*$/
);
const contentCheckList = [
  'module "',
  'provider "',
  'required_providers ',
  ' "helm_release" ',
  ' "docker_image" ',
  'required_version',
  'terraform_version', // part of  tfe_workspace
];

export async function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Promise<PackageFile | null> {
  logger.trace({ content }, 'terraform.extractPackageFile()');
  if (!checkFileContainsDependency(content, contentCheckList)) {
    logger.trace(
      { fileName },
      'preflight content check has not found any relevant content'
    );
    return null;
  }
  let deps: PackageDependency<TerraformManagerData>[] = [];
  try {
    const lines = content.split(newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const terraformDependency = dependencyBlockExtractionRegex.exec(line);
      if (terraformDependency?.groups) {
        logger.trace(
          `Matched ${terraformDependency.groups.type} on line ${lineNumber}`
        );
        const tfDepType = getTerraformDependencyType(
          terraformDependency.groups.type
        );
        let result: ExtractionResult | null = null;
        switch (tfDepType) {
          case TerraformDependencyTypes.required_providers: {
            result = extractTerraformRequiredProviders(lineNumber, lines);
            break;
          }
          case TerraformDependencyTypes.provider: {
            result = extractTerraformProvider(
              lineNumber,
              lines,
              terraformDependency.groups.packageName
            );
            break;
          }
          case TerraformDependencyTypes.module: {
            result = extractTerraformModule(
              lineNumber,
              lines,
              terraformDependency.groups.packageName
            );
            break;
          }
          case TerraformDependencyTypes.resource: {
            result = extractTerraformResource(lineNumber, lines);
            break;
          }
          case TerraformDependencyTypes.terraform_version: {
            result = extractTerraformRequiredVersion(lineNumber, lines);
            break;
          }
          /* istanbul ignore next */
          default:
            logger.trace(
              `Could not identify TerraformDependencyType ${terraformDependency.groups.type} on line ${lineNumber}.`
            );
            break;
        }
        if (result) {
          lineNumber = result.lineNumber;
          deps = deps.concat(result.dependencies);
          result = null;
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting terraform plugins');
  }

  const locks: ProviderLock[] = [];
  const lockFilePath = findLockFile(fileName);
  if (lockFilePath) {
    const lockFileContent = await readLockFile(lockFilePath);
    if (lockFileContent) {
      const extractedLocks = extractLocks(lockFileContent);
      if (is.nonEmptyArray(extractedLocks)) {
        locks.push(...extractedLocks);
      }
    }
  }

  deps.forEach((dep) => {
    switch (dep.managerData?.terraformDependencyType) {
      case TerraformDependencyTypes.required_providers:
        analyzeTerraformRequiredProvider(dep, locks);
        break;
      case TerraformDependencyTypes.provider:
        analyzeTerraformProvider(dep, locks);
        break;
      case TerraformDependencyTypes.module:
        analyseTerraformModule(dep);
        break;
      case TerraformDependencyTypes.resource:
        analyseTerraformResource(dep);
        break;
      case TerraformDependencyTypes.terraform_version:
        analyseTerraformVersion(dep);
        break;
      /* istanbul ignore next */
      default:
    }

    delete dep.managerData;
  });
  if (deps.some((dep) => dep.skipReason !== 'local')) {
    return { deps };
  }
  return null;
}

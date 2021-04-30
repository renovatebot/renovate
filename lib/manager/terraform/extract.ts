import { logger } from '../../logger';
import type { PackageDependency, PackageFile } from '../types';
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
import {
  TerraformDependencyTypes,
  TerraformManagerData,
  checkFileContainsDependency,
  getTerraformDependencyType,
} from './util';

const dependencyBlockExtractionRegex = /^\s*(?<type>[a-z_]+)\s+("(?<lookupName>[^"]+)"\s+)?("(?<terraformName>[^"]+)"\s+)?{\s*$/;
const contentCheckList = [
  'module "',
  'provider "',
  'required_providers ',
  ' "helm_release" ',
  ' "docker_image" ',
];

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace({ content }, 'terraform.extractPackageFile()');
  if (!checkFileContainsDependency(content, contentCheckList)) {
    return null;
  }
  let deps: PackageDependency<TerraformManagerData>[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const terraformDependency = dependencyBlockExtractionRegex.exec(line);
      if (terraformDependency) {
        logger.trace(
          `Matched ${terraformDependency.groups.type} on line ${lineNumber}`
        );
        const tfDepType = getTerraformDependencyType(
          terraformDependency.groups.type
        );
        let result = null;
        switch (tfDepType) {
          case TerraformDependencyTypes.required_providers: {
            result = extractTerraformRequiredProviders(lineNumber, lines);
            break;
          }
          case TerraformDependencyTypes.provider: {
            result = extractTerraformProvider(
              lineNumber,
              lines,
              terraformDependency.groups.lookupName
            );
            break;
          }
          case TerraformDependencyTypes.module: {
            result = extractTerraformModule(
              lineNumber,
              lines,
              terraformDependency.groups.lookupName
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
  deps.forEach((dep) => {
    switch (dep.managerData.terraformDependencyType) {
      case TerraformDependencyTypes.required_providers:
        analyzeTerraformRequiredProvider(dep);
        break;
      case TerraformDependencyTypes.provider:
        analyzeTerraformProvider(dep);
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
    // eslint-disable-next-line no-param-reassign
    delete dep.managerData;
  });
  if (deps.some((dep) => dep.skipReason !== 'local')) {
    return { deps };
  }
  return null;
}

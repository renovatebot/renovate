import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';
import { analyseTerraformModule, extractTerraformModule } from './modules';
import { analyzeTerraformProvider, extractTerraformProvider } from './provider';
import { extractTerraformRequiredProviders } from './required_providers';
import {
  TerraformDependencyTypes,
  checkFileContainsDependency,
  getTerraformDependencyType,
} from './util';

const dependencyBlockExtractionRegex = /^\s*(?<type>module|provider|required_providers)\s+("(?<lookupName>[^"]+)"\s+)?{\s*$/;
const contentCheckList = ['module "', 'provider "', 'required_providers '];

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace({ content }, 'terraform.extractPackageFile()');
  if (!checkFileContainsDependency(content, contentCheckList)) {
    return null;
  }
  let deps: PackageDependency[] = [];
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
          case TerraformDependencyTypes.unknown:
          default:
            logger.warn(
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
    logger.warn({ err }, 'Error extracting buildkite plugins');
  }
  deps.forEach((dep) => {
    switch (dep.managerData.terraformDependencyType) {
      case TerraformDependencyTypes.required_providers:
      case TerraformDependencyTypes.provider:
        analyzeTerraformProvider(dep);
        break;
      case TerraformDependencyTypes.module:
        analyseTerraformModule(dep);
        break;
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

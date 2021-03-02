import { logger } from '../../logger';
import type { PackageDependency, PackageFile } from '../types';
import { analyseTerragruntModule, extractTerragruntModule } from './modules';
import {
  TerraformManagerData,
  TerragruntDependencyTypes,
  checkFileContainsDependency,
  getTerragruntDependencyType,
} from './util';

const dependencyBlockExtractionRegex = /^\s*(?<type>[a-z_]+)\s+{\s*$/;
const contentCheckList = ['terraform {'];

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace({ content }, 'terragrunt.extractPackageFile()');
  if (!checkFileContainsDependency(content, contentCheckList)) {
    return null;
  }
  let deps: PackageDependency<TerraformManagerData>[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const terragruntDependency = dependencyBlockExtractionRegex.exec(line);
      if (terragruntDependency) {
        logger.trace(
          `Matched ${terragruntDependency.groups.type} on line ${lineNumber}`
        );
        const tfDepType = getTerragruntDependencyType(
          terragruntDependency.groups.type
        );
        let result = null;
        switch (tfDepType) {
          case TerragruntDependencyTypes.terragrunt: {
            result = extractTerragruntModule(lineNumber, lines);
            break;
          }
          /* istanbul ignore next */
          default:
            logger.trace(
              `Could not identify TerragruntDependencyType ${terragruntDependency.groups.type} on line ${lineNumber}.`
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
    logger.warn({ err }, 'Error extracting terragrunt plugins');
  }
  deps.forEach((dep) => {
    switch (dep.managerData.terragruntDependencyType) {
      case TerragruntDependencyTypes.terragrunt:
        analyseTerragruntModule(dep);
        break;
      /* istanbul ignore next */
      default:
    }
    // eslint-disable-next-line no-param-reassign
    delete dep.managerData;
  });
  return { deps };
}

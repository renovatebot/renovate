import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import type { PackageDependency, PackageFileContent } from '../types';
import { analyseTerragruntModule, extractTerragruntModule } from './modules';
import type { ExtractionResult, TerraformManagerData } from './types';
import {
  checkFileContainsDependency,
  getTerragruntDependencyType,
} from './util';

const dependencyBlockExtractionRegex = regEx(/^\s*(?<type>[a-z_]+)\s+{\s*$/);
const contentCheckList = ['terraform {'];

export function extractPackageFile(
  content: string,
  packageFile?: string
): PackageFileContent | null {
  logger.trace({ content }, `terragrunt.extractPackageFile(${packageFile!})`);
  if (!checkFileContainsDependency(content, contentCheckList)) {
    return null;
  }
  let deps: PackageDependency<TerraformManagerData>[] = [];
  try {
    const lines = content.split(newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const terragruntDependency = dependencyBlockExtractionRegex.exec(line);
      if (terragruntDependency?.groups) {
        logger.trace(
          `Matched ${terragruntDependency.groups.type} on line ${lineNumber}`
        );
        const tfDepType = getTerragruntDependencyType(
          terragruntDependency.groups.type
        );
        let result: ExtractionResult | null = null;
        switch (tfDepType) {
          case 'terraform': {
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
    logger.debug({ err, packageFile }, 'Error extracting terragrunt plugins');
  }
  deps.forEach((dep) => {
    // TODO #7154
    switch (dep.managerData!.terragruntDependencyType) {
      case 'terraform':
        analyseTerragruntModule(dep);
        break;
      /* istanbul ignore next */
      default:
    }

    delete dep.managerData;
  });
  return { deps };
}

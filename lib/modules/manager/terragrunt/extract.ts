import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { checkFileContainsDependency } from '../terraform/util.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { analyseTerragruntModule, extractTerragruntModule } from './modules.ts';
import type { TerraformManagerData } from './types.ts';

const dependencyBlockExtractionRegex = regEx(/^\s*(?<type>[a-z_]+)\s+{\s*$/);
const contentCheckList = ['terraform {'];
const includeBlockCheck = regEx(/include\s*(?:".*")?\s*\{/);

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  logger.trace({ content }, `terragrunt.extractPackageFile(${packageFile!})`);
  if (!checkFileContainsDependency(content, contentCheckList)) {
    if (content.match(includeBlockCheck)) {
      return { deps: [] };
    }
    return null;
  }
  let deps: PackageDependency<TerraformManagerData>[] = [];
  try {
    const lines = content.split(newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const terragruntDependency = dependencyBlockExtractionRegex.exec(line);
      if (terragruntDependency?.groups) {
        const { type } = terragruntDependency.groups;
        logger.trace(`Matched ${type} on line ${lineNumber}`);
        if (type === 'terraform') {
          const result = extractTerragruntModule(lineNumber, lines);
          lineNumber = result.lineNumber;
          deps = deps.concat(result.dependencies);
        } else {
          logger.trace(
            `Could not identify TerragruntDependencyType ${type} on line ${lineNumber}.`,
          );
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Error extracting terragrunt plugins');
  }
  for (const dep of deps) {
    analyseTerragruntModule(dep);
    delete dep.managerData;
  }
  return { deps };
}

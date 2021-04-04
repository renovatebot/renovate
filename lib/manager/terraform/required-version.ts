import * as datasourceGithubTags from '../../datasource/github-tags';
import { logger } from '../../logger';
import type { PackageDependency } from '../types';
import {
  ExtractionResult,
  TerraformDependencyTypes,
  keyValueExtractionRegex,
} from './util';

export function extractTerraformRequiredVersion(
  startingLine: number,
  lines: string[]
): ExtractionResult {
  const deps: PackageDependency[] = [];
  let lineNumber = startingLine;
  let braceCounter = 0;
  do {
    // istanbul ignore if
    if (lineNumber > lines.length - 1) {
      logger.debug(`Malformed Terraform file detected.`);
    }

    const line = lines[lineNumber];
    // `{` will be counted wit +1 and `}` with -1. Therefore if we reach braceCounter == 0. We have found the end of the terraform block
    const openBrackets = (line.match(/\{/g) || []).length;
    const closedBrackets = (line.match(/\}/g) || []).length;
    braceCounter = braceCounter + openBrackets - closedBrackets;

    const kvMatch = keyValueExtractionRegex.exec(line);
    if (kvMatch && kvMatch.groups.key === 'required_version') {
      const dep: PackageDependency = {
        currentValue: kvMatch.groups.value,
        lineNumber,
        managerData: {
          terraformDependencyType: TerraformDependencyTypes.terraform_version,
        },
      };
      deps.push(dep);
      // returning starting line as required_providers are also in the terraform block
      // if we would return the position of the required_version line we would potentially skip the providers
      return { lineNumber: startingLine, dependencies: deps };
    }

    lineNumber += 1;
  } while (braceCounter !== 0);
  return null;
}

export function analyseTerraformVersion(dep: PackageDependency): void {
  /* eslint-disable no-param-reassign */
  dep.depType = 'required_version';
  dep.datasource = datasourceGithubTags.id;
  dep.depName = 'hashicorp/terraform';
  dep.extractVersion = 'v(?<version>.*)$';
  /* eslint-enable no-param-reassign */
}

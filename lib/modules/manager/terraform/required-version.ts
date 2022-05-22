import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency } from '../types';
import { TerraformDependencyTypes } from './common';
import type { ExtractionResult, TerraformManagerData } from './types';
import { keyValueExtractionRegex } from './util';

export function extractTerraformRequiredVersion(
  startingLine: number,
  lines: string[]
): ExtractionResult | null {
  const deps: PackageDependency<TerraformManagerData>[] = [];
  let lineNumber = startingLine;
  let braceCounter = 0;
  do {
    // istanbul ignore if
    if (lineNumber > lines.length - 1) {
      logger.debug(`Malformed Terraform file detected.`);
    }

    const line = lines[lineNumber];
    // `{` will be counted wit +1 and `}` with -1. Therefore if we reach braceCounter == 0. We have found the end of the terraform block
    const openBrackets = (line.match(regEx(/\{/g)) || []).length;
    const closedBrackets = (line.match(regEx(/\}/g)) || []).length;
    braceCounter = braceCounter + openBrackets - closedBrackets;

    const kvMatch = keyValueExtractionRegex.exec(line);
    if (kvMatch?.groups && kvMatch.groups.key === 'required_version') {
      const dep: PackageDependency<TerraformManagerData> = {
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
  dep.depType = 'required_version';
  dep.datasource = GithubTagsDatasource.id;
  dep.depName = 'hashicorp/terraform';
  dep.extractVersion = 'v(?<version>.*)$';
}

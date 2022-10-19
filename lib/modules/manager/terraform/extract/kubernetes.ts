import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import { TerraformDependencyTypes } from '../common';
import type { ExtractionResult, ResourceManagerData } from '../types';
import { keyValueExtractionRegex } from '../util';

export function extractTerraformKubernetesResource(
  startingLine: number,
  lines: string[],
  resourceType: string
): ExtractionResult {
  let lineNumber = startingLine;
  const deps: PackageDependency<ResourceManagerData>[] = [];

  /**
   * Iterates over all lines of the resource to extract the relevant key value pairs,
   * e.g. the chart name for helm charts or the terraform_version for tfe_workspace
   */
  let braceCounter = 0;
  let inContainer = -1;
  do {
    // istanbul ignore if
    if (lineNumber > lines.length - 1) {
      logger.debug(`Malformed Terraform file detected.`);
    }

    const line = lines[lineNumber];

    // istanbul ignore else
    if (is.string(line)) {
      // `{` will be counted with +1 and `}` with -1. Therefore if we reach braceCounter == 0. We have found the end of the terraform block
      const openBrackets = (line.match(regEx(/\{/g)) ?? []).length;
      const closedBrackets = (line.match(regEx(/\}/g)) ?? []).length;
      braceCounter = braceCounter + openBrackets - closedBrackets;

      if (line.match(regEx(/^\s*(?:init_)?container(?:\s*\{|$)/s))) {
        inContainer = braceCounter;
      } else if (braceCounter < inContainer) {
        inContainer = -1;
      }

      const managerData: ResourceManagerData = {
        terraformDependencyType: TerraformDependencyTypes.resource,
        resourceType,
      };
      const dep: PackageDependency<ResourceManagerData> = {
        managerData,
      };

      const kvMatch = keyValueExtractionRegex.exec(line);
      if (kvMatch?.groups && inContainer > 0) {
        switch (kvMatch.groups.key) {
          case 'image':
            managerData[kvMatch.groups.key] = kvMatch.groups.value;
            managerData.sourceLine = lineNumber;
            deps.push(dep);
            break;
          default:
            /* istanbul ignore next */
            break;
        }
      }
    } else {
      // stop - something went wrong
      braceCounter = 0;
      inContainer = -1;
    }
    lineNumber += 1;
  } while (braceCounter !== 0);

  // remove last lineNumber addition to not skip a line after the last bracket
  lineNumber -= 1;
  return { lineNumber, dependencies: deps };
}

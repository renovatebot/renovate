import is from '@sindresorhus/is';
import { HelmDatasource } from '../../datasource/helm';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency } from '../types';
import { TerraformDependencyTypes, TerraformResourceTypes } from './common';
import { analyseTerraformVersion } from './required-version';
import type { ExtractionResult, ResourceManagerData } from './types';
import {
  checkIfStringIsPath,
  keyValueExtractionRegex,
  resourceTypeExtractionRegex,
} from './util';

function applyDockerDependency(
  dep: PackageDependency<ResourceManagerData>,
  value: string
): void {
  const dockerDep = getDep(value);
  Object.assign(dep, dockerDep);
}

export function extractTerraformResource(
  startingLine: number,
  lines: string[]
): ExtractionResult {
  let lineNumber = startingLine;
  let line = lines[lineNumber];
  const deps: PackageDependency<ResourceManagerData>[] = [];
  const managerData: ResourceManagerData = {
    terraformDependencyType: TerraformDependencyTypes.resource,
  };
  const dep: PackageDependency<ResourceManagerData> = {
    managerData,
  };

  const typeMatch = resourceTypeExtractionRegex.exec(line);

  // Sets the resourceType, e.g. "helm_release" 'resource "helm_release" "test_release"'
  managerData.resourceType =
    TerraformResourceTypes[typeMatch?.groups?.type as TerraformResourceTypes] ??
    TerraformResourceTypes.unknown;

  /**
   * Iterates over all lines of the resource to extract the relevant key value pairs,
   * e.g. the chart name for helm charts or the terraform_version for tfe_workspace
   */
  let braceCounter = 0;
  do {
    // istanbul ignore if
    if (lineNumber > lines.length - 1) {
      logger.debug(`Malformed Terraform file detected.`);
    }

    const line = lines[lineNumber];

    // istanbul ignore else
    if (is.string(line)) {
      // `{` will be counted wit +1 and `}` with -1. Therefore if we reach braceCounter == 0. We have found the end of the terraform block
      const openBrackets = (line.match(regEx(/\{/g)) || []).length;
      const closedBrackets = (line.match(regEx(/\}/g)) || []).length;
      braceCounter = braceCounter + openBrackets - closedBrackets;

      const kvMatch = keyValueExtractionRegex.exec(line);
      if (kvMatch?.groups) {
        switch (kvMatch.groups.key) {
          case 'chart':
          case 'image':
          case 'name':
          case 'repository':
            managerData[kvMatch.groups.key] = kvMatch.groups.value;
            break;
          case 'version':
          case 'terraform_version':
            dep.currentValue = kvMatch.groups.value;
            break;
          default:
            /* istanbul ignore next */
            break;
        }
      }
    } else {
      // stop - something went wrong
      braceCounter = 0;
    }
    lineNumber += 1;
  } while (braceCounter !== 0);
  deps.push(dep);

  // remove last lineNumber addition to not skip a line after the last bracket
  lineNumber -= 1;
  return { lineNumber, dependencies: deps };
}

export function analyseTerraformResource(
  dep: PackageDependency<ResourceManagerData>
): void {
  // istanbul ignore if: should tested?
  if (!dep.managerData) {
    return;
  }
  switch (dep.managerData.resourceType) {
    case TerraformResourceTypes.docker_container:
      if (dep.managerData.image) {
        applyDockerDependency(dep, dep.managerData.image);
        dep.depType = 'docker_container';
      } else {
        dep.skipReason = 'invalid-dependency-specification';
      }
      break;

    case TerraformResourceTypes.docker_image:
      if (dep.managerData.name) {
        applyDockerDependency(dep, dep.managerData.name);
        dep.depType = 'docker_image';
      } else {
        dep.skipReason = 'invalid-dependency-specification';
      }
      break;

    case TerraformResourceTypes.docker_service:
      if (dep.managerData.image) {
        applyDockerDependency(dep, dep.managerData.image);
        dep.depType = 'docker_service';
      } else {
        dep.skipReason = 'invalid-dependency-specification';
      }
      break;

    case TerraformResourceTypes.helm_release:
      if (!dep.managerData.chart) {
        dep.skipReason = 'invalid-name';
      } else if (checkIfStringIsPath(dep.managerData.chart)) {
        dep.skipReason = 'local-chart';
      }
      dep.depType = 'helm_release';
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      dep.registryUrls = [dep.managerData.repository!];
      dep.depName = dep.managerData.chart;
      dep.datasource = HelmDatasource.id;
      break;

    case TerraformResourceTypes.tfe_workspace:
      if (dep.currentValue) {
        analyseTerraformVersion(dep);
        dep.depType = 'tfe_workspace';
      } else {
        dep.skipReason = 'no-version';
      }
      break;

    default:
      dep.skipReason = 'invalid-value';
      break;
  }
}

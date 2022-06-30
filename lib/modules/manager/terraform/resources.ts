import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency } from '../types';
import { TerraformDependencyTypes, TerraformResourceTypes } from './common';
import { extractTerraformKubernetesResource } from './extract/kubernetes';
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
  const line = lines[lineNumber];
  const deps: PackageDependency<ResourceManagerData>[] = [];
  const managerData: ResourceManagerData = {
    terraformDependencyType: TerraformDependencyTypes.resource,
  };
  const dep: PackageDependency<ResourceManagerData> = {
    managerData,
  };

  const typeMatch = resourceTypeExtractionRegex.exec(line);

  // Sets the resourceType, e.g., 'resource "helm_release" "test_release"' -> helm_release
  const resourceType = typeMatch?.groups?.type;

  const isKnownType =
    resourceType &&
    Object.keys(TerraformResourceTypes).some((key) => {
      return TerraformResourceTypes[key].includes(resourceType);
    });

  if (isKnownType && resourceType.startsWith('kubernetes_')) {
    return extractTerraformKubernetesResource(
      startingLine,
      lines,
      resourceType
    );
  }

  managerData.resourceType = isKnownType
    ? resourceType
    : TerraformResourceTypes.unknown[0];

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
      // `{` will be counted with +1 and `}` with -1. Therefore if we reach braceCounter == 0. We have found the end of the terraform block
      const openBrackets = (line.match(regEx(/\{/g)) ?? []).length;
      const closedBrackets = (line.match(regEx(/\}/g)) ?? []).length;
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
  switch (dep.managerData?.resourceType) {
    case TerraformResourceTypes.generic_image_resource.find(
      (key) => key === dep.managerData?.resourceType
    ):
      if (dep.managerData.image) {
        applyDockerDependency(dep, dep.managerData.image);
        dep.depType = dep.managerData.resourceType;
      } else {
        dep.skipReason = 'invalid-dependency-specification';
      }
      break;

    case TerraformResourceTypes.docker_image[0]:
      if (dep.managerData.name) {
        applyDockerDependency(dep, dep.managerData.name);
        dep.depType = 'docker_image';
      } else {
        dep.skipReason = 'invalid-dependency-specification';
      }
      break;

    case TerraformResourceTypes.helm_release[0]:
      if (!dep.managerData.chart) {
        dep.skipReason = 'invalid-name';
      } else if (checkIfStringIsPath(dep.managerData.chart)) {
        dep.skipReason = 'local-chart';
      }
      dep.depType = 'helm_release';
      // TODO #7154
      dep.registryUrls = [dep.managerData.repository!];
      dep.depName = dep.managerData.chart;
      dep.datasource = HelmDatasource.id;
      break;

    case TerraformResourceTypes.tfe_workspace[0]:
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

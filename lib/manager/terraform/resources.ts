import * as datasourceHelm from '../../datasource/helm';
import { SkipReason } from '../../types';
import { isValid } from '../../versioning/hashicorp';
import { PackageDependency } from '../common';
import { getDep } from '../dockerfile/extract';
import {
  ExtractionResult,
  ResourceManagerData,
  TerraformDependencyTypes,
  TerraformResourceTypes,
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
  const deps: PackageDependency[] = [];
  const dep: PackageDependency<ResourceManagerData> = {
    managerData: {
      terraformDependencyType: TerraformDependencyTypes.resource,
    },
  };

  const typeMatch = resourceTypeExtractionRegex.exec(line);

  dep.managerData.resourceType =
    TerraformResourceTypes[typeMatch?.groups?.type] ??
    TerraformResourceTypes.unknown;

  do {
    lineNumber += 1;
    line = lines[lineNumber];
    const kvMatch = keyValueExtractionRegex.exec(line);
    if (kvMatch) {
      switch (kvMatch.groups.key) {
        case 'chart':
        case 'image':
        case 'name':
        case 'repository':
          dep.managerData[kvMatch.groups.key] = kvMatch.groups.value;
          break;
        case 'version':
          dep.currentValue = kvMatch.groups.value;
          break;
        default:
          /* istanbul ignore next */
          break;
      }
    }
  } while (line.trim() !== '}');
  deps.push(dep);
  return { lineNumber, dependencies: deps };
}

export function analyseTerraformResource(
  dep: PackageDependency<ResourceManagerData>
): void {
  /* eslint-disable no-param-reassign */

  switch (dep.managerData.resourceType) {
    case TerraformResourceTypes.docker_container:
      if (!dep.managerData.image) {
        dep.skipReason = SkipReason.InvalidDependencySpecification;
      } else {
        applyDockerDependency(dep, dep.managerData.image);
      }
      break;

    case TerraformResourceTypes.docker_image:
      if (!dep.managerData.name) {
        dep.skipReason = SkipReason.InvalidDependencySpecification;
      } else {
        applyDockerDependency(dep, dep.managerData.name);
      }
      break;

    case TerraformResourceTypes.docker_service:
      if (!dep.managerData.image) {
        dep.skipReason = SkipReason.InvalidDependencySpecification;
      } else {
        applyDockerDependency(dep, dep.managerData.image);
      }
      break;

    case TerraformResourceTypes.helm_release:
      if (dep.managerData.chart == null) {
        dep.skipReason = SkipReason.InvalidName;
      } else if (checkIfStringIsPath(dep.managerData.chart)) {
        dep.skipReason = SkipReason.LocalChart;
      } else if (!isValid(dep.currentValue)) {
        dep.skipReason = SkipReason.UnsupportedVersion;
      }
      dep.depType = 'helm';
      dep.registryUrls = [dep.managerData.repository];
      dep.depName = dep.managerData.chart;
      dep.depNameShort = dep.managerData.chart;
      dep.datasource = datasourceHelm.id;
      break;

    default:
      dep.skipReason = SkipReason.UnsupportedValue;
      break;
  }
  /* eslint-enable no-param-reassign */
}

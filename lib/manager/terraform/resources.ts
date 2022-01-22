import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency } from '../types';
import { TerraformResourceTypes } from './common';
import type { ResourceManagerData } from './types';
import { checkIfStringIsPath } from './util';

function applyDockerDependency(
  dep: PackageDependency<ResourceManagerData>,
  value: string
): void {
  const dockerDep = getDep(value);
  Object.assign(dep, dockerDep);
}

export function analyseTerraformResource(
  dep: PackageDependency<ResourceManagerData>
): PackageDependency<ResourceManagerData> {
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
      dep.registryUrls = [dep.managerData.repository];
      dep.depName = dep.managerData.chart;
      dep.datasource = HelmDatasource.id;
      break;

    default:
      dep.skipReason = 'invalid-value';
      break;
  }
  return dep;
}

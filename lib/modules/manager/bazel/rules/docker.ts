import is from '@sindresorhus/is';
import { DockerDatasource } from '../../../datasource/docker';
import { id as dockerVersioning } from '../../../versioning/docker';
import type { PackageDependency } from '../../types';
import type { Target } from '../types';

export function dockerDependency({
  rule: depType,
  name: depName,
  tag: currentValue,
  digest: currentDigest,
  repository: packageName,
  registry,
}: Target): PackageDependency | null {
  let dep: PackageDependency | null = null;

  if (
    depType === 'container_pull' &&
    is.string(depName) &&
    is.string(currentValue) &&
    is.string(currentDigest) &&
    is.string(packageName) &&
    is.string(registry)
  ) {
    dep = {
      datasource: DockerDatasource.id,
      versioning: dockerVersioning,
      depType,
      depName,
      packageName,
      currentValue,
      currentDigest,
      registryUrls: [registry],
    };
  }

  return dep;
}

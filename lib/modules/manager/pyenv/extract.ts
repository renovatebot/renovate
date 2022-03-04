import { DockerDatasource } from '../../datasource/docker';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  const dep: PackageDependency = {
    depName: 'python',
    currentValue: content.trim(),
    datasource: DockerDatasource.id,
  };
  return { deps: [dep] };
}

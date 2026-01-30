import { DockerDatasource } from '../../datasource/docker/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'python',
    commitMessageTopic: 'Python',
    currentValue: content.trim(),
    datasource: DockerDatasource.id,
  };
  return { deps: [dep] };
}

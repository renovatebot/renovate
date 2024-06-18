import { DockerDatasource } from '../../datasource/docker';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'python',
    commitMessageTopic: 'Python',
    currentValue: content.replaceAll('python-', '').trim(),
    datasource: DockerDatasource.id,
  };
  return { deps: [dep] };
}

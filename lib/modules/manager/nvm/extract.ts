import { NodeVersionDatasource } from '../../datasource/node-version';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'node',
    currentValue: content
      .split('\n')
      // Exclude code comments
      .filter((str) => !str.startsWith('#'))
      .join('\n')
      .trim(),
    datasource: NodeVersionDatasource.id,
  };
  return { deps: [dep] };
}

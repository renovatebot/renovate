import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'node',
    currentValue: content.trim(),
    datasource: NodeVersionDatasource.id,
  };
  return { deps: [dep] };
}

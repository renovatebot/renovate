import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'node',
    currentValue: content.trim(),
    datasource: GithubTagsDatasource.id,
    packageName: 'nodejs/node',
  };
  return { deps: [dep] };
}

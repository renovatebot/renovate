import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'bazel',
    currentValue: content.split('\n', 2)[0].trim(),
    datasource: GithubTagsDatasource.id,
    packageName: 'bazelbuild/bazel',
  };
  return { deps: [dep] };
}

import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  const dep: PackageDependency = {
    depName: 'bazel',
    currentValue: content.trim(),
    datasource: GithubTagsDatasource.id,
    packageName: 'bazelbuild/bazel',
  };
  return { deps: [dep] };
}

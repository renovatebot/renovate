import { GithubReleasesDatasource } from '../../datasource/github-releases';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  const dep: PackageDependency = {
    depName: 'bazel',
    currentValue: content.trim().split('\n', 2)[0],
    datasource: GithubReleasesDatasource.id,
    packageName: 'bazelbuild/bazel',
  };
  return { deps: [dep] };
}

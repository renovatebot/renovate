import { GithubReleasesDatasource } from '../../datasource/github-releases';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  const dep: PackageDependency = {
    depName: 'bazel',
    currentValue: content.split('\n', 2)[0].trim(),
    datasource: GithubReleasesDatasource.id,
    packageName: 'bazelbuild/bazel',
  };
  return { deps: [dep] };
}

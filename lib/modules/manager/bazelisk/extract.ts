import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'bazel',
    currentValue: content.split('\n', 2)[0].trim(),
    datasource: GithubReleasesDatasource.id,
    packageName: 'bazelbuild/bazel',
  };
  return { deps: [dep] };
}

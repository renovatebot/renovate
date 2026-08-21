import { logger } from '../../../logger/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

export function extractPackageFile(content: string): PackageFileContent {
  logger.trace('terraform-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'hashicorp/terraform',
    currentValue: content.trim(),
    datasource: GithubReleasesDatasource.id,
  };
  return { deps: [dep] };
}

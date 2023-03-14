import { logger } from '../../../logger';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  logger.trace('terraform-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'hashicorp/terraform',
    currentValue: content.trim(),
    datasource: GithubReleasesDatasource.id,
  };
  return { deps: [dep] };
}

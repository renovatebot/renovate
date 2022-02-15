import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { logger } from '../../logger';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  logger.trace('terraform-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'hashicorp/terraform',
    currentValue: content.trim(),
    datasource: GithubReleasesDatasource.id,
  };
  return { deps: [dep] };
}

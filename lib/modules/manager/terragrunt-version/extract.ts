import { logger } from '../../../logger';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  logger.trace('terragrunt-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'gruntwork-io/terragrunt',
    currentValue: content.trim(),
    datasource: GithubReleasesDatasource.id,
  };
  return { deps: [dep] };
}

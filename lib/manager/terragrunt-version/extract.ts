import * as datasourceGitHubRelease from '../../datasource/github-releases';
import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';

export function extractPackageFile(content: string): PackageFile {
  logger.trace('terragrunt-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'gruntwork-io/terragrunt',
    currentValue: content.trim(),
    datasource: datasourceGitHubRelease.id,
  };
  return { deps: [dep] };
}

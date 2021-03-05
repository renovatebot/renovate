import * as datasourceGitHubRelease from '../../datasource/github-releases';
import { logger } from '../../logger';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  logger.trace('terragrunt-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'gruntwork-io/terragrunt',
    currentValue: content.trim(),
    datasource: datasourceGitHubRelease.id,
  };
  return { deps: [dep] };
}

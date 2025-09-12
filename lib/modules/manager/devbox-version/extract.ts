import { logger } from '../../../logger';
import { DevboxVersionDatasource } from '../../datasource/devbox-version';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  logger.trace('devbox-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'devbox',
    currentValue: content.trim(),
    datasource: DevboxVersionDatasource.id,
  };
  return { deps: [dep] };
}

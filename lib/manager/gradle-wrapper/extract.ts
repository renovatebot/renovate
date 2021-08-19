import { GradleVersionDatasource } from '../../datasource/gradle-version';
import { logger } from '../../logger';
import { id as versioning } from '../../versioning/gradle';
import type { PackageDependency, PackageFile } from '../types';
import { extractGradleVersion } from './utils';

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.trace('gradle-wrapper.extractPackageFile()');
  const currentValue = extractGradleVersion(fileContent);
  if (currentValue) {
    const dependency: PackageDependency = {
      depName: 'gradle',
      currentValue,
      datasource: GradleVersionDatasource.id,
      versioning,
    };
    return { deps: [dependency] };
  }
  return null;
}

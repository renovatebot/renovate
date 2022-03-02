import { GradleVersionDatasource } from '../../datasource/gradle-version';
import { logger } from '../../logger';
import { id as versioning } from '../../modules/versioning/gradle';
import type { PackageDependency, PackageFile } from '../types';
import { extractGradleVersion } from './utils';

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.trace('gradle-wrapper.extractPackageFile()');
  const extractResult = extractGradleVersion(fileContent);
  if (extractResult) {
    const dependency: PackageDependency = {
      depName: 'gradle',
      currentValue: extractResult.version,
      replaceString: extractResult.url,
      datasource: GradleVersionDatasource.id,
      versioning,
    };
    return { deps: [dependency] };
  }
  return null;
}

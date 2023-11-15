import { logger } from '../../../logger';
import { GradleVersionDatasource } from '../../datasource/gradle-version';
import { id as versioning } from '../../versioning/gradle';
import type { PackageDependency, PackageFileContent } from '../types';
import { extractGradleVersion } from './utils';

export function extractPackageFile(
  fileContent: string,
): PackageFileContent | null {
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

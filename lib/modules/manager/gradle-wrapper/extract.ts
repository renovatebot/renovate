import { logger } from '../../../logger/index.ts';
import { GradleVersionDatasource } from '../../datasource/gradle-version/index.ts';
import { id as versioning } from '../../versioning/gradle/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { extractGradleVersion } from './utils.ts';

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

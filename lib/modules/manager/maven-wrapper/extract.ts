import { logger } from '../../../logger';
import type { /*PackageDependency, */ PackageFile } from '../types';
import type { MavenVersionExtract } from './types';

function extractVersions(fileContent: string): MavenVersionExtract | null {
  return null;
}

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.trace('gradle-wrapper.extractPackageFile()');
  const extractResult = extractVersions(fileContent);
  if (extractResult) {
    // const dependency: PackageDependency = {
    //   depName: 'gradle',
    //   currentValue: extractResult.version,
    //   replaceString: extractResult.url,
    //   datasource: GradleVersionDatasource.id,
    //   versioning,
    // };
    return { deps: [] };
  }
  return null;
}

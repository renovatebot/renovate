import * as datasourceGradleVersion from '../../datasource/gradle-version';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import * as gradleVersioning from '../../versioning/gradle';
import type { PackageDependency, PackageFile } from '../types';

// https://regex101.com/r/1GaQ2X/1
const DISTRIBUTION_URL_REGEX = regEx(
  '^(?:distributionUrl\\s*=\\s*)\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*)-(?<type>bin|all)\\.zip\\s*$'
);

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.debug('gradle-wrapper.extractPackageFile()');
  const lines = fileContent.split('\n');

  for (const line of lines) {
    const distributionUrlMatch = DISTRIBUTION_URL_REGEX.exec(line);
    if (distributionUrlMatch) {
      const dependency: PackageDependency = {
        depName: 'gradle',
        currentValue: distributionUrlMatch.groups.version,
        datasource: datasourceGradleVersion.id,
        versioning: gradleVersioning.id,
      };
      logger.debug(dependency, 'Gradle Wrapper');
      return { deps: [dependency] };
    }
  }
  return null;
}

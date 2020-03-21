import { coerce } from 'semver';
import { logger } from '../../logger';
import { PackageFile, PackageDependency } from '../common';
import * as semverVersioning from '../../versioning/semver';
import * as datasourceGradleVersion from '../../datasource/gradle-version';
import { DISTRIBUTION_CHECKSUM_REGEX, DISTRIBUTION_URL_REGEX } from './search';

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.debug('gradle-wrapper.extractPackageFile()');
  const lines = fileContent.split('\n');

  let lineNumber = 0;
  for (const line of lines) {
    const distributionUrlMatch = DISTRIBUTION_URL_REGEX.exec(line);
    if (distributionUrlMatch) {
      const dependency: PackageDependency = {
        datasource: datasourceGradleVersion.id,
        depType: 'gradle-wrapper',
        depName: 'gradle',
        currentValue: coerce(distributionUrlMatch.groups.version).toString(),
        managerData: {
          lineNumber,
          gradleWrapperType: distributionUrlMatch.groups.type,
        },
        versioning: semverVersioning.id,
      };

      let shaLineNumber = 0;
      for (const shaLine of lines) {
        const shaMatch = DISTRIBUTION_CHECKSUM_REGEX.test(shaLine);
        if (shaMatch) {
          dependency.managerData.checksumLineNumber = shaLineNumber;
          break;
        }
        shaLineNumber += 1;
      }

      logger.debug(dependency, 'Gradle Wrapper');
      return { deps: [dependency] };
    }
    lineNumber += 1;
  }
  return null;
}

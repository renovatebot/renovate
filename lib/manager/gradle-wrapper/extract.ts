import { coerce } from 'semver';
import { logger } from '../../logger';
import { PackageFile, PackageDependency } from '../common';
import * as semverVersioning from '../../versioning/semver';
import * as datasourceGradleVersion from '../../datasource/gradle-version';

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.debug('gradle-wrapper.extractPackageFile()');
  const lines = fileContent.split('\n');

  let lineNumber = 0;
  for (const line of lines) {
    const match = /^distributionUrl=.*-((\d|\.)+)-(bin|all)\.zip\s*$/.exec(
      line
    );
    if (match) {
      const dependency: PackageDependency = {
        datasource: datasourceGradleVersion.id,
        depType: 'gradle-wrapper',
        depName: 'gradle',
        currentValue: coerce(match[1]).toString(),
        managerData: { lineNumber, gradleWrapperType: match[3] },
        versioning: semverVersioning.id,
      };

      let shaLineNumber = 0;
      for (const shaLine of lines) {
        const shaMatch = /^distributionSha256Sum=((\w){64}).*$/.test(shaLine);
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

import { coerce } from 'semver';
import { logger } from '../../logger';
import { PackageFile, PackageDependency } from '../common';

export function extractPackageFile(fileContent: string): PackageFile {
  logger.debug('gradle-wrapper.extractPackageFile()');
  const lines = fileContent.split('\n');

  let lineNumber = 0;
  for (const line of lines) {
    const match = line.match(
      /^distributionUrl=.*-((\d|\.)+)-(bin|all)\.zip\s*$/
    );
    if (match) {
      const dependency: PackageDependency = {
        datasource: 'gradleVersion',
        depType: 'gradle-wrapper',
        depName: 'gradle',
        currentValue: coerce(match[1]).toString(),
        managerData: { lineNumber, gradleWrapperType: match[3] },
        versionScheme: 'semver',
      };

      let shaLineNumber = 0;
      for (const shaLine of lines) {
        const shaMatch = shaLine.match(/^distributionSha256Sum=((\w){64}).*$/);
        if (shaMatch) {
          dependency.managerData.checksumLineNumber = shaLineNumber;
          break;
        }
        shaLineNumber += 1;
      }

      logger.info(dependency, 'Gradle Wrapper');
      return { deps: [dependency] };
    }
    lineNumber += 1;
  }
  return null;
}

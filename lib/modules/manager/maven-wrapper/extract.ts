import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { MavenDatasource } from '../../datasource/maven';
import { id as versioning } from '../../versioning/maven';
import type {
  /*PackageDependency, */ PackageDependency,
  PackageFile,
} from '../types';
import type { MavenVersionExtract } from './types';

// https://regex101.com/r/IcOs7P/1
const DISTRIBUTION_URL_REGEX = regEx(
  '^(?:distributionUrl\\s*=\\s*)(?<url>\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*)-(?<type>bin|all)\\.zip)\\s*$'
);

const WRAPPER_URL_REGEX = regEx(
  '^(?:wrapperUrl\\s*=\\s*)(?<url>\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*)(?:.jar))'
);

function extractVersions(fileContent: string): MavenVersionExtract {
  const lines = fileContent?.split(newlineRegex) ?? [];
  const maven = extractLineInfo(lines, DISTRIBUTION_URL_REGEX);
  const wrapper = extractLineInfo(lines, WRAPPER_URL_REGEX);
  return { maven, wrapper };
}

function extractLineInfo(lines: string[], regex: RegExp): any {
  return lines
    .filter((line) => line.match(regex))
    .map((line) => {
      const match = regex.exec(line);
      if (match?.groups) {
        return {
          url: match.groups.url,
          version: match.groups.version,
        };
      }
      return null;
    })[0];
}

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.trace('maven-wrapper.extractPackageFile()');
  const extractResult = extractVersions(fileContent);
  const deps = [];
  if (extractResult) {
    if (extractResult.maven?.version) {
      const maven: PackageDependency = {
        depName: 'maven',
        currentValue: extractResult.maven?.version,
        replaceString: extractResult.maven?.url,
        datasource: MavenDatasource.id,
        versioning,
      };
      deps.push(maven);
    }

    if (extractResult.wrapper?.version) {
      const wrapper: PackageDependency = {
        depName: 'maven-wrapper',
        currentValue: extractResult.wrapper?.version,
        replaceString: extractResult.wrapper?.url,
        datasource: MavenDatasource.id,
        versioning,
      };
      deps.push(wrapper);
    }
    return { deps };
  }
  return null;
}

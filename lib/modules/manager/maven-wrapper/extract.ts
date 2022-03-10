import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
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
  '^(?:wrapperUrl\\s*=\\s*)(?<url>\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*))'
);

function extractVersions(fileContent: string): MavenVersionExtract {
  const lines = fileContent?.split(newlineRegex) ?? [];
  const lineInfo = extractLineInfo(lines, [
    DISTRIBUTION_URL_REGEX,
    WRAPPER_URL_REGEX,
  ]);

  const [maven, wrapper] = lineInfo;
  return { maven, wrapper };
}

function extractLineInfo(lines: string[], regexes: RegExp[]): any {
  const result = regexes.map((regex) =>
    lines
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
      })
  );

  return [...result[0], ...result[1]];
}

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.trace('gradle-wrapper.extractPackageFile()');
  const extractResult = extractVersions(fileContent);
  if (extractResult) {
    const maven: PackageDependency = {
      depName: 'maven',
      currentValue: extractResult.maven?.version,
      replaceString: extractResult.maven?.url,
      datasource: 'maven',
      versioning: 'maven',
    };

    const wrapper: PackageDependency = {
      depName: 'maven-wrapper',
      currentValue: extractResult.wrapper?.version,
      replaceString: extractResult.wrapper?.url,
      datasource: 'maven',
      versioning: 'maven',
    };
    return { deps: [maven, wrapper] };
  }
  return null;
}

import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { newlineRegex, regEx } from '../../../util/regex';
import { MavenDatasource } from '../../datasource/maven';
import { id as versioning } from '../../versioning/maven';
import type { PackageDependency, PackageFileContent } from '../types';
import type { MavenVersionExtract, Version } from './types';

// https://regex101.com/r/IcOs7P/1
const DISTRIBUTION_URL_REGEX = regEx(
  '^(?:distributionUrl\\s*=\\s*)(?<url>\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*)-(?<type>bin|all)\\.zip)\\s*$',
);

const WRAPPER_URL_REGEX = regEx(
  '^(?:wrapperUrl\\s*=\\s*)(?<url>\\S*-(?<version>\\d+\\.\\d+(?:\\.\\d+)?(?:-\\w+)*)(?:.jar))',
);

function extractVersions(fileContent: string): MavenVersionExtract {
  const lines = coerceArray(fileContent?.split(newlineRegex));
  const maven = extractLineInfo(lines, DISTRIBUTION_URL_REGEX) ?? undefined;
  const wrapper = extractLineInfo(lines, WRAPPER_URL_REGEX) ?? undefined;
  return { maven, wrapper };
}

function extractLineInfo(lines: string[], regex: RegExp): Version | null {
  for (const line of lines) {
    if (line.match(regex)) {
      const match = regex.exec(line);
      if (match?.groups) {
        return {
          url: match.groups.url,
          version: match.groups.version,
        };
      }
    }
  }
  return null;
}

export function extractPackageFile(
  fileContent: string,
): PackageFileContent | null {
  logger.trace('maven-wrapper.extractPackageFile()');
  const extractResult = extractVersions(fileContent);
  const deps = [];

  if (extractResult.maven?.version) {
    const maven: PackageDependency = {
      depName: 'maven',
      packageName: 'org.apache.maven:apache-maven',
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
      packageName: 'org.apache.maven.wrapper:maven-wrapper',
      currentValue: extractResult.wrapper?.version,
      replaceString: extractResult.wrapper?.url,
      datasource: MavenDatasource.id,
      versioning,
    };
    deps.push(wrapper);
  }
  return deps.length ? { deps } : null;
}

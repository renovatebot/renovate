import { regEx } from '../../../util/regex.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

const scalafmtVersionRegex = regEx(
  'version *= *"?(?<version>\\d+\\.\\d+\\.\\d+)"?',
);

export function extractPackageFile(content: string): PackageFileContent | null {
  const regexResult = scalafmtVersionRegex.exec(content);
  const scalafmtVersion = regexResult?.groups?.version;

  if (!scalafmtVersion) {
    return null;
  }

  const scalafmtDependency: PackageDependency = {
    datasource: GithubReleasesDatasource.id,
    depName: 'scalafmt',
    packageName: 'scalameta/scalafmt',
    versioning: semverVersioning.id,
    currentValue: scalafmtVersion,
    extractVersion: '^v(?<version>\\S+)',
  };

  return {
    deps: [scalafmtDependency],
  };
}

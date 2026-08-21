import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { id as semverVersioning } from '../../versioning/semver/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

const VERSION_REGEX = regEx(/^\s+VERSION="(.*)"$/m);

export function extractPackageFile(
  fileContent: string,
): PackageFileContent | null {
  logger.trace('batect.extractPackageFile()');
  const match = VERSION_REGEX.exec(fileContent);

  if (match === null) {
    return null;
  }

  const dependency: PackageDependency = {
    depName: 'batect/batect',
    commitMessageTopic: 'Batect',
    currentValue: match[1],
    datasource: GithubReleasesDatasource.id,
    versioning: semverVersioning,
  };

  logger.trace(dependency, 'Found Batect wrapper version');

  return { deps: [dependency] };
}

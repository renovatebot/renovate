import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { id as semverVersioning } from '../../versioning/semver';
import type { PackageDependency, PackageFileContent } from '../types';

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

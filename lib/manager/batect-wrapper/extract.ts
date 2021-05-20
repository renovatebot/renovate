import { id as githubReleaseDatasource } from '../../datasource/github-releases';
import { logger } from '../../logger';
import { id as semverVersioning } from '../../versioning/semver';
import type { PackageDependency, PackageFile } from '../types';

const VERSION_REGEX = /^\s+VERSION="(.*)"$/m;

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.trace('batect.extractPackageFile()');
  const match = VERSION_REGEX.exec(fileContent);

  if (match === null) {
    return null;
  }

  const dependency: PackageDependency = {
    depName: 'batect/batect',
    commitMessageTopic: 'Batect',
    currentValue: match[1],
    datasource: githubReleaseDatasource,
    versioning: semverVersioning,
  };

  logger.trace(dependency, 'Found Batect wrapper version');

  return { deps: [dependency] };
}

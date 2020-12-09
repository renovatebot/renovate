import { id as githubReleaseDatasource } from '../../datasource/github-releases';
import { logger } from '../../logger';
import { id as semverVersioning } from '../../versioning/semver';
import { PackageDependency, PackageFile } from '../common';

const VERSION_REGEX = /^\s+VERSION="(?<version>.*)"$/gm;

export function extractPackageFile(fileContent: string): PackageFile | null {
  logger.debug('batect.extractPackageFile()');
  const matches = [...fileContent.matchAll(VERSION_REGEX)];

  if (matches.length !== 1) {
    return null;
  }

  const match = matches[0];

  const dependency: PackageDependency = {
    depName: 'batect/batect',
    commitMessageTopic: 'Batect',
    currentValue: match.groups.version,
    datasource: githubReleaseDatasource,
    versioning: semverVersioning,
  };

  logger.debug(dependency, 'Found Batect wrapper version');

  return { deps: [dependency] };
}

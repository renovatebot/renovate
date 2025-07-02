import type { ReleaseType } from 'semver';
import { DockerDatasource } from '../../datasource/docker';
import type { PackageDependency, PackageFileContent } from '../types';

function getBumpVersion(version: string): ReleaseType | undefined {
  const dots = version.trim().split(/\./);
  const numberOfDots = dots.length - 1;

  if (numberOfDots === 1) {
    return 'minor';
  } else if (numberOfDots === 2) {
    return 'patch';
  }

  return undefined;
}

function getVersionsFromMultilineString(content: string): string[] {
  const lines: string[] = content.split(/\r?\n/);
  const resultingVersions: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('#')) {
      continue;
    }

    const version = line.trim().split('#')[0].trim();

    if (version === '') {
      continue;
    }

    resultingVersions.push(version);
  }

  return resultingVersions;
}

export function extractPackageFile(content: string): PackageFileContent {
  const deps: PackageDependency[] = [];

  for (const version of getVersionsFromMultilineString(content.trim())) {
    const dep: PackageDependency = {
      depName: 'python',
      commitMessageTopic: 'Python',
      currentValue: version,
      datasource: DockerDatasource.id,
      bumpVersion: getBumpVersion(version),
      fileReplacePosition: content.indexOf(version),
    };

    deps.push(dep);
  }

  return { deps };
}

import { regEx } from '../../../util/regex';
import { Unity3dDatasource } from '../../datasource/unity3d';
import type { PackageDependency, PackageFileContent } from '../types';

const supportedKeys = ['m_EditorVersion', 'm_EditorVersionWithRevision'];

const UnityVersionRegex = regEx(/^(?<depName>.+): (?<currentValue>.+)/);

function extractVersions(content: string): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (const line of content.split('\n')) {
    const matches = UnityVersionRegex.exec(line);

    if (!matches?.groups) {
      continue;
    }

    const key = matches.groups.depName;
    const value = matches.groups.currentValue;

    if (!supportedKeys.includes(key)) {
      continue;
    }

    deps.push({
      currentValue: value,
      datasource: Unity3dDatasource.id,
      depName: 'Unity Editor',
      packageName: key,
    });
  }

  return deps;
}

export function extractPackageFile(content: string): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  deps.push(...extractVersions(content));

  if (!deps.length) {
    return null;
  }

  return { deps };
}

import { regEx } from '../../../util/regex';
import type { PackageDependency, PackageFileContent } from '../types';

export const fileMatchRegex: string[] = [
  '(^|/)ProjectSettings/ProjectVersion.txt',
];

const supportedExtensionsKey = [
  'm_EditorVersionWithRevision',
  'm_EditorVersion',
];
function parseLine(line: string): PackageDependency | null {
  const matches = regEx(/^(?<depName>.+): (?<currentValue>.+)/g).exec(line);
  if (!matches) {
    return null;
  }
  const key = matches.groups?.depName;
  const version = matches.groups?.currentValue;
  if (!key || !version || !supportedExtensionsKey.includes(key)) {
    return null;
  }

  if (version !== version.trim()) {
    return null;
  }

  return {
    currentValue: version,
    datasource: 'unity3d',
    depName: key,
    depType: 'final',
  };
};

export function extractPackageFile(
  content: string,
  fileName: string,
): PackageFileContent {
  if (!fileMatchRegex.every((regex: string) => regEx(regex).test(fileName))) {
    return { deps: [] };
  }

  return {
    deps: content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map(parseLine)
      .filter((dep) => dep !== null) as PackageDependency[],
  };
}

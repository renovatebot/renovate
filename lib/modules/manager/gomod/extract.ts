import { newlineRegex } from '../../../util/regex';
import type { PackageDependency, PackageFileContent } from '../types';
import { parseLine } from './line-parser';

export function extractPackageFile(content: string): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  const lines = content.split(newlineRegex);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const dep = parseLine(line);
    if (!dep) {
      continue;
    }

    dep.managerData ??= {};
    dep.managerData.lineNumber = lineNumber;

    deps.push(dep);
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}

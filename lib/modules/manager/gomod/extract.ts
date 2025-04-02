import { newlineRegex } from '../../../util/regex';
import type { PackageDependency, PackageFileContent } from '../types';
import { parseLine } from './line-parser';

function findMatchingModule(
  tool: PackageDependency,
  deps: PackageDependency[],
): PackageDependency | undefined {
  let bestMatch: PackageDependency | undefined;
  const normalizedTool = tool.depName! + '/';

  // Find the longest matching prefix for the tool within the dependencies
  for (const dep of deps) {
    if (
      normalizedTool.startsWith(dep.depName! + '/') &&
      dep.depName!.length > (bestMatch?.depName!.length ?? 0)
    ) {
      bestMatch = dep;
    }
  }

  return bestMatch;
}

export function extractPackageFile(content: string): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  const tools: PackageDependency[] = [];

  const lines = content.split(newlineRegex);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const dep = parseLine(line);
    if (!dep) {
      continue;
    }

    if (dep.depType === 'tool') {
      tools.push(dep);
      continue;
    }

    dep.managerData ??= {};
    dep.managerData.lineNumber = lineNumber;

    deps.push(dep);
  }

  for (const tool of tools) {
    const match = findMatchingModule(tool, deps);
    if (match?.depType === 'indirect') {
      delete match.enabled;
    }
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}

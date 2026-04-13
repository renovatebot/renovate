import { newlineRegex } from '../../../util/regex.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import {
  endBlockRegex,
  excludeBlockStartRegex,
  parseLine,
} from './line-parser.ts';

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
  let inExcludeBlock = false;

  const lines = content.split(newlineRegex);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const dep = parseLine(line);

    if (inExcludeBlock) {
      if (endBlockRegex.test(line)) {
        inExcludeBlock = false;
      }
      continue;
    }

    if (!dep) {
      if (excludeBlockStartRegex.test(line)) {
        inExcludeBlock = true;
      }
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

  const packageFile: PackageFileContent = {
    deps,
  };

  const goDirective = packageFile.deps.find(
    (dep) =>
      dep.depName === 'go' &&
      dep.depType === 'golang' &&
      dep.datasource === 'golang-version',
  );
  if (goDirective?.currentValue) {
    packageFile.extractedConstraints ??= {};
    // TODO #31831
    packageFile.extractedConstraints['%goMod'] =
      convertGoDirectiveToSemVerRange(goDirective.currentValue);
  }

  const toolchainDirective = packageFile.deps.find(
    (dep) =>
      dep.depName === 'go' &&
      dep.depType === 'toolchain' &&
      dep.datasource === 'golang-version',
  );
  if (toolchainDirective?.currentValue) {
    packageFile.extractedConstraints ??= {};
    packageFile.extractedConstraints.go = toolchainDirective.currentValue;
  }

  return packageFile;
}

function convertGoDirectiveToSemVerRange(
  goDirective: string | undefined,
): string | undefined {
  if (!goDirective) {
    return undefined;
  }

  const parts = goDirective.split('.');
  return `^${parts[0]}.${parts[1]}.x`;
}

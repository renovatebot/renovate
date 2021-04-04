import type { PackageDependency } from '../types';
import { analyzeTerraformProvider } from './providers';
import {
  ExtractionResult,
  TerraformDependencyTypes,
  keyValueExtractionRegex,
} from './util';

export const providerBlockExtractionRegex = /^\s*(?<key>[^\s]+)\s+=\s+{/;

function extractBlock(
  lineNum: number,
  lines: string[],
  dep: PackageDependency
): number {
  let lineNumber = lineNum;
  let line: string;
  do {
    lineNumber += 1;
    line = lines[lineNumber];
    const kvMatch = keyValueExtractionRegex.exec(line);
    if (kvMatch) {
      /* eslint-disable no-param-reassign */
      switch (kvMatch.groups.key) {
        case 'source':
          dep.managerData.source = kvMatch.groups.value;
          break;

        case 'version':
          dep.currentValue = kvMatch.groups.value;
          break;

        /* istanbul ignore next */
        default:
          break;
      }
      /* eslint-enable no-param-reassign */
    }
  } while (line.trim() !== '}');
  return lineNumber;
}

export function extractTerraformRequiredProviders(
  startingLine: number,
  lines: string[]
): ExtractionResult {
  let lineNumber = startingLine;
  let line: string;
  const deps: PackageDependency[] = [];
  do {
    const dep: PackageDependency = {
      managerData: {
        terraformDependencyType: TerraformDependencyTypes.required_providers,
      },
    };

    lineNumber += 1;
    line = lines[lineNumber];
    const kvMatch = keyValueExtractionRegex.exec(line);
    if (kvMatch) {
      dep.currentValue = kvMatch.groups.value;
      dep.managerData.moduleName = kvMatch.groups.key;
      deps.push(dep);
    } else {
      const nameMatch = providerBlockExtractionRegex.exec(line);

      if (nameMatch?.groups) {
        dep.managerData.moduleName = nameMatch.groups.key;
        lineNumber = extractBlock(lineNumber, lines, dep);
        deps.push(dep);
      }
    }
  } while (line.trim() !== '}');
  return { lineNumber, dependencies: deps };
}

export function analyzeTerraformRequiredProvider(dep: PackageDependency): void {
  /* eslint-disable no-param-reassign */
  analyzeTerraformProvider(dep);
  dep.depType = `required_provider`;
  /* eslint-enable no-param-reassign */
}

import { regEx } from '../../../util/regex';
import type { PackageDependency } from '../types';
import { TerraformDependencyTypes } from './common';
import type { ProviderLock } from './lockfile/types';
import { analyzeTerraformProvider } from './providers';
import type { ExtractionResult, TerraformManagerData } from './types';
import { keyValueExtractionRegex } from './util';

export const providerBlockExtractionRegex = regEx(/^\s*(?<key>[^\s]+)\s+=\s+{/);

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
    if (kvMatch?.groups) {
      switch (kvMatch.groups.key) {
        case 'source':
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          dep.managerData!.source = kvMatch.groups.value;
          break;

        case 'version':
          dep.currentValue = kvMatch.groups.value;
          break;

        /* istanbul ignore next */
        default:
          break;
      }
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
  const deps: PackageDependency<TerraformManagerData>[] = [];
  do {
    const dep: PackageDependency<TerraformManagerData> = {
      managerData: {
        terraformDependencyType: TerraformDependencyTypes.required_providers,
      },
    };

    lineNumber += 1;
    line = lines[lineNumber];
    const kvMatch = keyValueExtractionRegex.exec(line);
    if (kvMatch?.groups) {
      dep.currentValue = kvMatch.groups.value;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      dep.managerData!.moduleName = kvMatch.groups.key;
      deps.push(dep);
    } else {
      const nameMatch = providerBlockExtractionRegex.exec(line);

      if (nameMatch?.groups) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        dep.managerData!.moduleName = nameMatch.groups.key;
        lineNumber = extractBlock(lineNumber, lines, dep);
        deps.push(dep);
      }
    }
  } while (line.trim() !== '}');
  return { lineNumber, dependencies: deps };
}

export function analyzeTerraformRequiredProvider(
  dep: PackageDependency,
  locks: ProviderLock[]
): void {
  analyzeTerraformProvider(dep, locks);
  dep.depType = `required_provider`;
}

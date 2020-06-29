import { TerraformDependencyTypes } from '../../../dist/manager/terraform/extract';
import { PackageDependency } from '../common';
import { ExtractionResult, keyValueExtractionRegex } from './util';

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
      dep.managerData.versionLine = lineNumber;
      deps.push(dep);
    }
  } while (line.trim() !== '}');
  return { lineNumber, dependencies: deps };
}

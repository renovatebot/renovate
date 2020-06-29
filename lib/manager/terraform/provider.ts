import * as datasourceTerraformProvider from '../../datasource/terraform-provider';
import { SkipReason } from '../../types';
import { isValid } from '../../versioning/hashicorp';
import { PackageDependency } from '../common';
import {
  ExtractionResult,
  TerraformDependencyTypes,
  keyValueExtractionRegex,
} from './util';

export function extractTerraformProvider(
  startingLine: number,
  lines: string[],
  moduleName: string
): ExtractionResult {
  let lineNumber = startingLine;
  let line: string;
  const deps: PackageDependency[] = [];
  const dep: PackageDependency = {
    managerData: {
      moduleName,
      terraformDependencyType: TerraformDependencyTypes.provider,
    },
  };
  do {
    lineNumber += 1;
    line = lines[lineNumber];
    const kvMatch = keyValueExtractionRegex.exec(line);
    if (kvMatch) {
      if (kvMatch.groups.key === 'version') {
        dep.currentValue = kvMatch.groups.value;
        dep.managerData.versionLine = lineNumber;
      } else if (kvMatch.groups.key === 'source') {
        dep.managerData.source = kvMatch.groups.value;
        dep.managerData.sourceLine = lineNumber;
      }
    }
  } while (line.trim() !== '}');
  deps.push(dep);
  return { lineNumber, dependencies: deps };
}

export function analyzeTerraformProvider(dep: PackageDependency): void {
  /* eslint-disable no-param-reassign */
  dep.depType = 'terraform';
  dep.depName = dep.managerData.moduleName;
  dep.depNameShort = dep.managerData.moduleName;
  dep.datasource = datasourceTerraformProvider.id;
  if (!isValid(dep.currentValue)) {
    dep.skipReason = SkipReason.UnsupportedVersion;
  }
}

import * as datasourceHelm from '../../datasource/helm';
import { SkipReason } from '../../types';
import { isValid } from '../../versioning/cargo';
import { PackageDependency } from '../common';
import {
  ExtractionResult,
  TerraformDependencyTypes,
  checkIfStringIsPath,
  keyValueExtractionRegex,
} from './util';

export function extractTerraformResource(
  startingLine: number,
  lines: string[]
): ExtractionResult {
  let lineNumber = startingLine;
  let line;
  const deps: PackageDependency[] = [];
  const dep: PackageDependency = {
    managerData: {
      terraformDependencyType: TerraformDependencyTypes.resource,
    },
  };

  do {
    lineNumber += 1;
    line = lines[lineNumber];
    const kvMatch = keyValueExtractionRegex.exec(line);
    if (kvMatch) {
      if (kvMatch.groups.key === 'version') {
        dep.currentValue = kvMatch.groups.value;
      } else if (kvMatch.groups.key === 'chart') {
        dep.managerData.chart = kvMatch.groups.value;
      } else if (kvMatch.groups.key === 'repository') {
        dep.managerData.repository = kvMatch.groups.value;
      }
    }
  } while (line.trim() !== '}');
  deps.push(dep);
  return { lineNumber, dependencies: deps };
}
export function analyseTerraformResource(dep: PackageDependency): void {
  /* eslint-disable no-param-reassign */
  if (dep.managerData.chart == null) {
    dep.skipReason = SkipReason.InvalidName;
  } else if (checkIfStringIsPath(dep.managerData.chart)) {
    dep.skipReason = SkipReason.LocalChart;
  } else if (!isValid(dep.currentValue)) {
    dep.skipReason = SkipReason.UnsupportedVersion;
  }
  dep.depType = 'helm';
  dep.registryUrls = [dep.managerData.repository];
  dep.depName = dep.managerData.chart;
  dep.depNameShort = dep.managerData.chart;
  dep.datasource = datasourceHelm.id;
  /* eslint-enable no-param-reassign */
}

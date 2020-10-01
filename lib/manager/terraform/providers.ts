import is from '@sindresorhus/is';
import * as datasourceTerraformProvider from '../../datasource/terraform-provider';
import { SkipReason } from '../../types';
import { isValid } from '../../versioning/hashicorp';
import { PackageDependency } from '../common';
import {
  ExtractionResult,
  TerraformDependencyTypes,
  keyValueExtractionRegex,
} from './util';

export const sourceExtractionRegex = /^(?:(?<hostname>(?:[a-zA-Z0-9]+\.+)+[a-zA-Z0-9]+)\/)?(?:(?<namespace>[^/]+)\/)?(?<type>[^/]+)/;

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

  if (is.nonEmptyString(dep.managerData.source)) {
    const source = sourceExtractionRegex.exec(dep.managerData.source);
    if (source) {
      if (source.groups.hostname) {
        dep.registryUrls = [`https://${source.groups.hostname}`];
        dep.lookupName = source.groups.namespace
          ? `${source.groups.namespace}/`
          : '';
        dep.lookupName += source.groups.type;
      } else {
        dep.lookupName = dep.managerData.source;
      }
    } else {
      dep.skipReason = SkipReason.UnsupportedUrl;
    }
  }
  /* eslint-enable no-param-reassign */
}

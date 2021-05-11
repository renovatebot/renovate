import is from '@sindresorhus/is';
import * as datasourceTerraformProvider from '../../datasource/terraform-provider';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import type { PackageDependency } from '../types';
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
  const deps: PackageDependency[] = [];
  const dep: PackageDependency = {
    managerData: {
      moduleName,
      terraformDependencyType: TerraformDependencyTypes.provider,
    },
  };
  let braceCounter = 0;
  do {
    // istanbul ignore if
    if (lineNumber > lines.length - 1) {
      logger.debug(`Malformed Terraform file detected.`);
    }

    const line = lines[lineNumber];
    // `{` will be counted wit +1 and `}` with -1. Therefore if we reach braceCounter == 0. We have found the end of the terraform block
    const openBrackets = (line.match(/\{/g) || []).length;
    const closedBrackets = (line.match(/\}/g) || []).length;
    braceCounter = braceCounter + openBrackets - closedBrackets;

    // only update fields inside the root block
    if (braceCounter === 1) {
      const kvMatch = keyValueExtractionRegex.exec(line);
      if (kvMatch) {
        if (kvMatch.groups.key === 'version') {
          dep.currentValue = kvMatch.groups.value;
        } else if (kvMatch.groups.key === 'source') {
          dep.managerData.source = kvMatch.groups.value;
          dep.managerData.sourceLine = lineNumber;
        }
      }
    }

    lineNumber += 1;
  } while (braceCounter !== 0);
  deps.push(dep);

  // remove last lineNumber addition to not skip a line after the last bracket
  lineNumber -= 1;
  return { lineNumber, dependencies: deps };
}

export function analyzeTerraformProvider(dep: PackageDependency): void {
  /* eslint-disable no-param-reassign */
  dep.depType = 'provider';
  dep.depName = dep.managerData.moduleName;
  dep.datasource = datasourceTerraformProvider.id;

  if (is.nonEmptyString(dep.managerData.source)) {
    const source = sourceExtractionRegex.exec(dep.managerData.source);
    if (source) {
      // buildin providers https://github.com/terraform-providers
      if (source.groups.namespace === 'terraform-providers') {
        dep.registryUrls = [`https://releases.hashicorp.com`];
      } else if (source.groups.hostname) {
        dep.registryUrls = [`https://${source.groups.hostname}`];
        dep.lookupName = `${source.groups.namespace}/${source.groups.type}`;
      } else {
        dep.lookupName = dep.managerData.source;
      }
    } else {
      dep.skipReason = SkipReason.UnsupportedUrl;
    }
  }
  /* eslint-enable no-param-reassign */
}

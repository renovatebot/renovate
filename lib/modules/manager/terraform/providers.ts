import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider';
import type { PackageDependency } from '../types';
import { TerraformDependencyTypes } from './common';
import type { ProviderLock } from './lockfile/types';
import type { ExtractionResult, TerraformManagerData } from './types';
import {
  getLockedVersion,
  keyValueExtractionRegex,
  massageProviderLookupName,
} from './util';

export const sourceExtractionRegex = regEx(
  /^(?:(?<hostname>(?:[a-zA-Z0-9]+\.+)+[a-zA-Z0-9]+)\/)?(?:(?<namespace>[^/]+)\/)?(?<type>[^/]+)/
);

export function extractTerraformProvider(
  startingLine: number,
  lines: string[],
  moduleName: string
): ExtractionResult {
  let lineNumber = startingLine;
  const deps: PackageDependency<TerraformManagerData>[] = [];
  const dep: PackageDependency<TerraformManagerData> = {
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

    // istanbul ignore else
    if (is.string(line)) {
      // `{` will be counted wit +1 and `}` with -1. Therefore if we reach braceCounter == 0. We have found the end of the terraform block
      const openBrackets = (line.match(regEx(/\{/g)) || []).length;
      const closedBrackets = (line.match(regEx(/\}/g)) || []).length;
      braceCounter = braceCounter + openBrackets - closedBrackets;

      // only update fields inside the root block
      if (braceCounter === 1) {
        const kvMatch = keyValueExtractionRegex.exec(line);
        if (kvMatch?.groups) {
          if (kvMatch.groups.key === 'version') {
            dep.currentValue = kvMatch.groups.value;
          } else if (kvMatch.groups.key === 'source') {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            dep.managerData!.source = kvMatch.groups.value;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            dep.managerData!.sourceLine = lineNumber;
          }
        }
      }
    } else {
      // stop - something went wrong
      braceCounter = 0;
    }
    lineNumber += 1;
  } while (braceCounter !== 0);
  deps.push(dep);

  // remove last lineNumber addition to not skip a line after the last bracket
  lineNumber -= 1;
  return { lineNumber, dependencies: deps };
}

export function analyzeTerraformProvider(
  dep: PackageDependency,
  locks: ProviderLock[]
): void {
  dep.depType = 'provider';
  dep.depName = dep.managerData?.moduleName;
  dep.datasource = TerraformProviderDatasource.id;

  if (is.nonEmptyString(dep.managerData?.source)) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const source = sourceExtractionRegex.exec(dep.managerData!.source);
    if (!source?.groups) {
      dep.skipReason = 'unsupported-url';
      return;
    }

    // buildin providers https://github.com/terraform-providers
    if (source.groups.namespace === 'terraform-providers') {
      dep.registryUrls = [`https://releases.hashicorp.com`];
    } else if (source.groups.hostname) {
      dep.registryUrls = [`https://${source.groups.hostname}`];
      dep.packageName = `${source.groups.namespace}/${source.groups.type}`;
    } else {
      dep.packageName = dep.managerData?.source;
    }
  }
  massageProviderLookupName(dep);

  dep.lockedVersion = getLockedVersion(dep, locks);

  if (!dep.currentValue) {
    dep.skipReason = 'no-version';
  }
}

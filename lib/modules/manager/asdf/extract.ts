import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { isSkipComment } from '../../../util/ignore';
import { regEx } from '../../../util/regex';
import type { PackageDependency, PackageFile } from '../types';
import { upgradeableTooling } from './upgradeable-tooling';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('asdf.extractPackageFile()');

  const regex = regEx(
    /^(?<toolName>([\w_-]+)) (?<version>[^\s#]+)(?: [^\s#]+)* *(?: #(?<comment>.*))?$/gm
  );

  const deps: PackageDependency[] = [];

  for (const groups of [...content.matchAll(regex)]
    .map((m) => m.groups)
    .filter(is.truthy)) {
    const toolName = groups.toolName.trim();
    const version = groups.version.trim();

    const toolConfig = upgradeableTooling[toolName];
    const toolDefinition =
      typeof toolConfig === 'function' ? toolConfig(version) : toolConfig;

    if (toolDefinition) {
      const dep: PackageDependency = {
        currentValue: version,
        depName: toolName,
        ...toolDefinition,
      };
      if (isSkipComment((groups.comment ?? '').trim())) {
        dep.skipReason = 'ignored';
      }

      deps.push(dep);
    } else {
      const dep: PackageDependency = {
        depName: toolName.trim(),
        skipReason: 'unsupported-datasource',
      };

      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}

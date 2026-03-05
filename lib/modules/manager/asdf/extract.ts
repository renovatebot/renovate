import { isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { isSkipComment } from '../../../util/ignore.ts';
import { regEx } from '../../../util/regex.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { upgradeableTooling } from './upgradeable-tooling.ts';

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace(`asdf.extractPackageFile()`);

  const regex = regEx(
    /^(?<toolName>([\w_-]+)) +(?<version>[^\s#]+)(?: +[^\s#]+)* *(?: #(?<comment>.*))?$/gm,
  );

  const deps: PackageDependency[] = [];

  for (const groups of [...content.matchAll(regex)]
    .map((m) => m.groups)
    .filter(isTruthy)) {
    const depName = groups.toolName.trim();
    const version = groups.version.trim();

    const toolConfig = upgradeableTooling[depName];
    const toolDefinition = toolConfig
      ? typeof toolConfig.config === 'function'
        ? toolConfig.config(version)
        : toolConfig.config
      : undefined;

    if (toolDefinition) {
      const dep: PackageDependency = {
        currentValue: version,
        depName,
        ...toolDefinition,
      };
      if (isSkipComment((groups.comment ?? '').trim())) {
        dep.skipReason = 'ignored';
      }

      deps.push(dep);
    } else {
      const dep: PackageDependency = {
        depName,
        skipReason: 'unsupported-datasource',
      };

      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}

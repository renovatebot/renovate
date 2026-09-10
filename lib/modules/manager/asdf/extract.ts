import { isFunction, isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import type { ConstraintName } from '../../../util/exec/types.ts';
import { isSkipComment } from '../../../util/ignore.ts';
import { regEx } from '../../../util/regex.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type { StaticTooling } from './types.ts';
import { upgradeableTooling } from './upgradeable-tooling.ts';

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace(`asdf.extractPackageFile()`);

  const regex = regEx(
    /^(?<toolName>(?:[\w_-]+)) +(?<version>[^\s#]+)(?: +[^\s#]+)* *(?: #(?<comment>.*))?$/gm,
  );

  const deps: PackageDependency[] = [];
  const extractedConstraints: Partial<Record<ConstraintName, string>> = {};
  const constraintNames: ConstraintName[] = [
    'bun',
    'node',
    'yarn',
    'npm',
    'pnpm',
    'vscode',
  ];

  for (const groups of [...content.matchAll(regex)]
    .map((m) => m.groups)
    .filter(isTruthy)) {
    const depName = groups.toolName.trim();
    const version = groups.version.trim();
    const isIgnored = isSkipComment((groups.comment ?? '').trim());
    const constraintName =
      depName === 'nodejs'
        ? 'node'
        : constraintNames.find((name) => name === depName);
    if (!isIgnored && constraintName) {
      extractedConstraints[constraintName] = version;
    }

    const toolConfig = upgradeableTooling[depName];
    let toolDefinition: StaticTooling | undefined;
    if (toolConfig) {
      toolDefinition = isFunction(toolConfig.config)
        ? toolConfig.config(version)
        : toolConfig.config;
    }

    if (toolDefinition) {
      const dep: PackageDependency = {
        currentValue: version,
        depName,
        ...toolDefinition,
      };
      if (isIgnored) {
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

  return deps.length ? { deps, extractedConstraints } : null;
}

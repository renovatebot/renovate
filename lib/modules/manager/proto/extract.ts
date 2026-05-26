import { logger } from '../../../logger/index.ts';
import type { StaticTooling } from '../asdf/upgradeable-tooling.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { ProtoToolsFile } from './schema.ts';
import { protoTooling } from './upgradeable-tooling.ts';

/**
 * Version aliases that cannot be updated via semver.
 */
const versionAliases = new Set(['latest', 'stable', 'canary', 'nightly']);

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`proto.extractPackageFile(${packageFile})`);

  const parsed = ProtoToolsFile.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { err: parsed.error, packageFile },
      'Error parsing proto .prototools file.',
    );
    return null;
  }

  const { versions } = parsed.data;
  const deps: PackageDependency[] = [];

  for (const [toolName, version] of Object.entries(versions)) {
    deps.push(createDependency(toolName, version));
  }

  return deps.length ? { deps } : null;
}

function createDependency(name: string, version: string): PackageDependency {
  if (versionAliases.has(version)) {
    return {
      depName: name,
      currentValue: version,
      skipReason: 'unsupported-version',
    };
  }

  const config = getToolConfig(name);
  if (!config) {
    return {
      depName: name,
      currentValue: version,
      skipReason: 'unsupported-datasource',
    };
  }

  return {
    depName: name,
    currentValue: version,
    ...config,
  };
}

function getToolConfig(toolName: string): StaticTooling | null {
  const toolDefinition = protoTooling[toolName];
  if (!toolDefinition) {
    return null;
  }

  return toolDefinition.config;
}

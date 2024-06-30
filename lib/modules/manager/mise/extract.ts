import { logger } from '../../../logger';
import { parse as parseToml } from '../../../util/toml';
import type { PackageDependency, PackageFileContent } from '../types';
import type { MiseFile } from './types';
import { ToolingConfig, asdfTooling, miseTooling } from './upgradeable-tooling';

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace(`mise.extractPackageFile()`);

  let misefile: MiseFile;

  try {
    misefile = parseToml(content) as MiseFile;
  } catch (err) {
    logger.debug({ err }, 'Error parsing .mise.toml file');
    return null;
  }

  const deps: PackageDependency[] = [];
  const tools = misefile.tools;

  if (tools) {
    Object.entries(tools).forEach(([name, versions]) => {
      const depName = name.trim();
      const version = Array.isArray(versions) ? versions[0] : versions;

      const toolConfig = getToolConfig(depName, version);
      const dep = createDependency(depName, version, toolConfig);

      deps.push(dep);
    });
  }

  return deps.length ? { deps } : null;
}

function getToolConfig(
  name: string,
  version: string,
): ToolingConfig | undefined {
  const toolDefinition = miseTooling[name] || asdfTooling[name];
  return toolDefinition
    ? typeof toolDefinition.config === 'function'
      ? toolDefinition.config(version)
      : toolDefinition.config
    : undefined;
}

function createDependency(
  name: string,
  version: string,
  config?: ToolingConfig,
): PackageDependency {
  if (config) {
    return {
      depName: name,
      currentValue: version,
      ...config,
    };
  } else {
    return {
      depName: name,
      skipReason: 'unsupported-datasource',
    };
  }
}

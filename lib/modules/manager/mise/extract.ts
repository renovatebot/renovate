import { logger } from '../../../logger';
import { parse as parseToml } from '../../../util/toml';
import type { ToolingConfig } from '../asdf/upgradeable-tooling';
import type { PackageDependency, PackageFileContent } from '../types';
import type { MiseFile, MisePackages } from './types';
import {
  ToolingDefinition,
  asdfTooling,
  miseTooling,
} from './upgradeable-tooling';

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace(`mise.extractPackageFile()`);

  let misefile: MiseFile;

  try {
    misefile = parseToml(content) as MiseFile;
  } catch (err) {
    logger.debug({ err }, 'Mise: error parsing .mise.toml');
    return null;
  }

  const deps: PackageDependency[] = [];
  const tools = misefile.tools;

  if (tools) {
    for (const [name, toolData] of Object.entries(tools)) {
      const version = parseVersion(toolData);
      const depName = name.trim();
      const toolConfig = getToolConfig(depName, version);
      const dep = createDependency(depName, version, toolConfig);
      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}

function parseVersion(
  toolData: MisePackages[keyof MisePackages],
): string | undefined {
  if (typeof toolData === 'string') {
    // Handle the string case
    // e.g. 'erlang = "23.3"'
    return toolData;
  } else if (
    typeof toolData === 'object' &&
    'version' in toolData &&
    typeof toolData.version === 'string'
  ) {
    // Handle the object case with a string version
    // e.g. 'python = { version = "3.11.2" }'
    return toolData.version;
  } else if (Array.isArray(toolData)) {
    // Handle the array case
    // e.g. 'erlang = ["23.3", "24.0"]'
    return toolData[0]; // Get the first version in the array
  }
  return undefined; // Return undefined if no version is found
}

function getToolConfig(
  name: string,
  version: string | undefined,
): ToolingConfig | undefined {
  if (!version) {
    return undefined; // Early return if version is undefined
  }

  // Try to get the config from miseTooling first, then asdfTooling
  return (
    getConfigFromTooling(miseTooling, name, version) ??
    getConfigFromTooling(asdfTooling, name, version)
  );
}

// Define getConfigFromTooling as a named function outside of getToolConfig
function getConfigFromTooling(
  toolingSource: Record<string, ToolingDefinition>,
  name: string,
  version: string,
): ToolingConfig | undefined {
  const toolDefinition = toolingSource[name];
  return (
    toolDefinition &&
    (typeof toolDefinition.config === 'function'
      ? toolDefinition.config(version)
      : toolDefinition.config)
  );
}

function createDependency(
  name: string,
  version: string | undefined,
  config: ToolingConfig | undefined,
): PackageDependency {
  if (!version) {
    return { depName: name, skipReason: 'unspecified-version' };
  }
  if (!config) {
    return { depName: name, skipReason: 'unsupported-datasource' };
  }
  return {
    depName: name,
    currentValue: version,
    ...config,
  };
}

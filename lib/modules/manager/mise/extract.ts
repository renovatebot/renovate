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
): string | null {
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
  return null; // Return null if no version is found
}

function getToolConfig(
  name: string,
  version: string | null,
): ToolingConfig | null {
  if (version === null) {
    return null; // Early return if version is null
  }

  // Try to get the config from miseTooling first, then asdfTooling
  return (
    getConfigFromTooling(miseTooling, name, version) ??
    getConfigFromTooling(asdfTooling, name, version)
  );
}

function getConfigFromTooling(
  toolingSource: Record<string, ToolingDefinition>,
  name: string,
  version: string,
): ToolingConfig | null {
  const toolDefinition = toolingSource[name];
  if (!toolDefinition) {
    return null;
  } // Return null if no toolDefinition is found

  return (
    (typeof toolDefinition.config === 'function'
      ? toolDefinition.config(version)
      : toolDefinition.config) ?? null
  ); // Ensure null is returned instead of undefined
}

function createDependency(
  name: string,
  version: string | null,
  config: ToolingConfig | null,
): PackageDependency {
  if (version === null) {
    return { depName: name, skipReason: 'unspecified-version' };
  }
  if (config === null) {
    return { depName: name, skipReason: 'unsupported-datasource' };
  }
  return {
    depName: name,
    currentValue: version,
    ...config,
  };
}

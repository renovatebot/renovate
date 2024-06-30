import { logger } from '../../../logger';
import { parse as parseToml } from '../../../util/toml';
import type { ToolingConfig } from '../asdf/upgradeable-tooling';
import type { PackageDependency, PackageFileContent } from '../types';
import type { MiseFile } from './types';
import { asdfTooling, miseTooling } from './upgradeable-tooling';

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
      let version: string | undefined;

      if (typeof toolData === 'string') {
        // Handle the string case
        // e.g. 'erlang = "23.3"'
        version = toolData;
      } else if (
        typeof toolData === 'object' &&
        'version' in toolData &&
        typeof toolData.version === 'string'
      ) {
        // Handle the object case with a string version
        // e.g. 'python = { version = "3.11.2" }'
        version = toolData.version;
      } else if (Array.isArray(toolData)) {
        // Handle the array case
        // e.g. 'erlang = ["23.3", "24.0"]'
        version = toolData[0]; // Get the first version in the array
      }

      const depName = name.trim();
      const toolConfig = getToolConfig(depName, version);
      const dep = createDependency(depName, version, toolConfig);
      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}

function getToolConfig(
  name: string,
  version: string | undefined,
): ToolingConfig | undefined {
  if (version === undefined) {
    return undefined; // Early return if version is undefined
  }

  let toolDefinition = miseTooling[name];
  let config = toolDefinition
    ? typeof toolDefinition.config === 'function'
      ? toolDefinition.config(version)
      : toolDefinition.config
    : undefined;

  // If config is not found in miseTooling, try asdfTooling
  // Example being Java JRE - not in miseTooling but in asdfTooling
  if (!config) {
    toolDefinition = asdfTooling[name];
    config = toolDefinition
      ? typeof toolDefinition.config === 'function'
        ? toolDefinition.config(version)
        : toolDefinition.config
      : undefined;
  }

  return config;
}

function createDependency(
  name: string,
  version?: string,
  config?: ToolingConfig,
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

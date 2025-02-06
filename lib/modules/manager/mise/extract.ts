import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { ToolingConfig } from '../asdf/upgradeable-tooling';
import type { PackageDependency, PackageFileContent } from '../types';
import type { MiseToolSchema } from './schema';
import type { ToolingDefinition } from './upgradeable-tooling';
import { asdfTooling, miseTooling } from './upgradeable-tooling';
import { parseTomlFile } from './utils';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`mise.extractPackageFile(${packageFile})`);

  const misefile = parseTomlFile(content, packageFile);
  if (!misefile) {
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

function parseVersion(toolData: MiseToolSchema): string | null {
  if (is.nonEmptyString(toolData)) {
    // Handle the string case
    // e.g. 'erlang = "23.3"'
    return toolData;
  }
  if (is.array(toolData, is.string)) {
    // Handle the array case
    // e.g. 'erlang = ["23.3", "24.0"]'
    return toolData.length ? toolData[0] : null; // Get the first version in the array
  }
  if (is.nonEmptyString(toolData.version)) {
    // Handle the object case with a string version
    // e.g. 'python = { version = "3.11.2" }'
    return toolData.version;
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

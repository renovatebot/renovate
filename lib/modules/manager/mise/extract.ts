import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import type { ToolingConfig } from '../asdf/upgradeable-tooling';
import type { PackageDependency, PackageFileContent } from '../types';
import type { BackendToolingConfig } from './backends';
import {
  createAquaToolConfig,
  createCargoToolConfig,
  createDotnetToolConfig,
  createGemToolConfig,
  createGoToolConfig,
  createNpmToolConfig,
  createPipxToolConfig,
  createSpmToolConfig,
  createUbiToolConfig,
} from './backends';
import type { MiseTool, MiseToolOptions } from './schema';
import type { ToolingDefinition } from './upgradeable-tooling';
import { asdfTooling, miseTooling } from './upgradeable-tooling';
import { parseTomlFile } from './utils';

// Tool names can have options in the tool name
// e.g. ubi:tamasfe/taplo[matching=full,exe=taplo]
const optionInToolNameRegex = regEx(/^(?<name>.+?)(?:\[(?<options>.+)\])?$/);

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
      // Parse the tool options in the tool name
      const { name: depName, options: optionsInName } =
        optionInToolNameRegex.exec(name.trim())!.groups!;
      const delimiterIndex = name.indexOf(':');
      const backend = depName.substring(0, delimiterIndex);
      const toolName = depName.substring(delimiterIndex + 1);
      const options = parseOptions(
        optionsInName,
        is.nonEmptyObject(toolData) ? toolData : {},
      );
      const toolConfig =
        version === null
          ? null
          : getToolConfig(backend, toolName, version, options);
      const dep = createDependency(depName, version, toolConfig);
      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}

function parseVersion(toolData: MiseTool): string | null {
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
  if (is.object(toolData) && is.nonEmptyString(toolData.version)) {
    // Handle the object case with a string version
    // e.g. 'python = { version = "3.11.2" }'
    return toolData.version;
  }
  return null; // Return null if no version is found
}

function parseOptions(
  optionsInName: string,
  toolOptions: MiseToolOptions,
): MiseToolOptions {
  const options = is.nonEmptyString(optionsInName)
    ? Object.fromEntries(
        optionsInName.split(',').map((option) => option.split('=', 2)),
      )
    : {};
  // Options in toolOptions will override options in the tool name
  return {
    ...options,
    ...toolOptions,
  };
}

function getToolConfig(
  backend: string,
  toolName: string,
  version: string,
  toolOptions: MiseToolOptions,
): ToolingConfig | BackendToolingConfig | null {
  switch (backend) {
    case '':
      // If the tool name does not specify a backend, it should be a short name or an alias defined by users
      return getRegistryToolConfig(toolName, version);
    // We can specify core, asdf, vfox, aqua backends for tools in the default registry
    // e.g. 'core:rust', 'asdf:rust', 'vfox:clang', 'aqua:act'
    case 'core':
      return getConfigFromTooling(miseTooling, toolName, version);
    case 'asdf':
      return getConfigFromTooling(asdfTooling, toolName, version);
    case 'vfox':
      return getRegistryToolConfig(toolName, version);
    case 'aqua':
      return (
        getRegistryToolConfig(toolName, version) ??
        createAquaToolConfig(toolName, version)
      );
    case 'cargo':
      return createCargoToolConfig(toolName, version);
    case 'dotnet':
      return createDotnetToolConfig(toolName);
    case 'gem':
      return createGemToolConfig(toolName);
    case 'go':
      return createGoToolConfig(toolName);
    case 'npm':
      return createNpmToolConfig(toolName);
    case 'pipx':
      return createPipxToolConfig(toolName);
    case 'spm':
      return createSpmToolConfig(toolName);
    case 'ubi':
      return createUbiToolConfig(toolName, version, toolOptions);
    default:
      // Unsupported backend
      return null;
  }
}

/**
 * Get the tooling config for a short name defined in the default registry
 * @link https://mise.jdx.dev/registry.html
 */
function getRegistryToolConfig(
  short: string,
  version: string,
): ToolingConfig | null {
  // Try to get the config from miseTooling first, then asdfTooling
  return (
    getConfigFromTooling(miseTooling, short, version) ??
    getConfigFromTooling(asdfTooling, short, version)
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
    (is.function(toolDefinition.config)
      ? toolDefinition.config(version)
      : toolDefinition.config) ?? null
  ); // Ensure null is returned instead of undefined
}

function createDependency(
  name: string,
  version: string | null,
  config: ToolingConfig | BackendToolingConfig | null,
): PackageDependency {
  if (version === null) {
    return {
      depName: name,
      skipReason: 'unspecified-version',
    };
  }
  if (config === null) {
    return {
      depName: name,
      skipReason: 'unsupported-datasource',
    };
  }

  return {
    depName: name,
    currentValue: version,
    // Spread the config last to override other properties
    ...config,
  };
}

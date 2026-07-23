import {
  isArray,
  isFunction,
  isNonEmptyString,
  isObject,
} from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { StaticTooling } from '../asdf/upgradeable-tooling.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type { BackendToolingConfig } from './backends.ts';
import {
  createAquaToolConfig,
  createCargoToolConfig,
  createDotnetToolConfig,
  createGemToolConfig,
  createGithubToolConfig,
  createGoToolConfig,
  createNpmToolConfig,
  createPipxToolConfig,
  createSpmToolConfig,
  createUbiToolConfig,
} from './backends.ts';
import { getLockFileName, getLockedVersion } from './lockfile.ts';
import type { MiseTool, MiseToolOptions } from './schema.ts';
import { MiseLockFile } from './schema.ts';
import type { ToolingDefinition } from './upgradeable-tooling.ts';
import {
  asdfTooling,
  getOrderedMiseRegistryBackends,
  miseTooling,
} from './upgradeable-tooling.ts';
import { parseTomlFile } from './utils.ts';

// Tool names can have options in the tool name
// e.g. ubi:tamasfe/taplo[matching=full,exe=taplo]
const optionInToolNameRegex = regEx(/^(?<name>.+?)(?:\[(?<options>.+)\])?$/);

/**
 * Extracts mise tool dependencies from a mise configuration file.
 * Supports various backends (core, asdf, aqua, cargo, etc.) and
 * extracts locked versions when a corresponding lock file exists.
 */
export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`mise.extractPackageFile(${packageFile})`);

  const misefile = parseTomlFile(content, packageFile);
  if (!misefile) {
    return null;
  }

  const deps: PackageDependency[] = [];

  for (const [name, toolData] of Object.entries(misefile.tools)) {
    deps.push(extractToolEntry(name, toolData));
  }

  for (const taskData of Object.values(misefile.tasks)) {
    for (const [name, toolData] of Object.entries(taskData.tools ?? {})) {
      deps.push(extractToolEntry(name, toolData));
    }
  }

  if (!deps.length) {
    return null;
  }

  const result: PackageFileContent = { deps };

  const lockFileName = getLockFileName(packageFile);
  const lockFileContent = await readLocalFile(lockFileName, 'utf8');

  if (lockFileContent) {
    const lockFileParsed = MiseLockFile.safeParse(lockFileContent);
    if (lockFileParsed.success) {
      result.lockFiles = [lockFileName];
      for (const dep of deps) {
        const lockedVersion = getLockedVersion(
          lockFileParsed.data,
          dep.depName!,
        );
        if (lockedVersion) {
          dep.lockedVersion = lockedVersion;
        }
      }
    } else {
      logger.debug(
        { lockFileName, error: lockFileParsed.error },
        'Failed to parse mise lock file',
      );
    }
  }

  return result;
}

interface ToolVersionSpec {
  version: string;
  options: MiseToolOptions;
}

function parseVersion(toolData: MiseTool): ToolVersionSpec | null {
  if (isNonEmptyString(toolData)) {
    // Handle the string case
    // e.g. 'erlang = "23.3"'
    return { version: toolData, options: {} };
  }
  if (isArray(toolData)) {
    // Handle the array case, only the first (primary) version is used
    // e.g. 'erlang = ["23.3", "24.0"]' -> "23.3"
    // or 'dotnet = [{ version = "8.0.14", runtime = "dotnet" }, { version = "10.0.301" }]' -> "8.0.14"
    const first = toolData.length ? toolData[0] : undefined;
    if (isNonEmptyString(first)) {
      return { version: first, options: {} };
    }
    if (isObject(first) && isNonEmptyString(first.version)) {
      return { version: first.version, options: first };
    }
    return null;
  }
  if (isObject(toolData) && isNonEmptyString(toolData.version)) {
    // Handle the object case with a string version
    // e.g. 'python = { version = "3.11.2" }'
    return { version: toolData.version, options: toolData };
  }
  return null; // Return null if no version is found
}

function parseOptions(
  optionsInName: string,
  toolOptions: MiseToolOptions,
): MiseToolOptions {
  const options = isNonEmptyString(optionsInName)
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
): StaticTooling | BackendToolingConfig | null {
  switch (backend) {
    case '': {
      // If the tool name does not specify a backend, it should be a short name or an alias defined by users
      const staticResult = getRegistryToolConfig(
        toolName,
        version,
        toolOptions,
      );
      if (staticResult) {
        return staticResult;
      }

      // Otherwise, see if we have any known short tool names that are in the `mise-registry.json` data file
      const backends = getOrderedMiseRegistryBackends(toolName);

      // prioritise the github backend as the best source for data
      if (backends.github) {
        const result = getToolConfig(
          'github',
          backends.github,
          version,
          toolOptions,
        );
        // v8 ignore else -- TODO: add test #40625
        if (result !== null) {
          return result;
        }
      }

      for (const [backendType, backendName] of Object.entries(backends)) {
        const result = getToolConfig(
          backendType,
          backendName,
          version,
          toolOptions,
        );
        // v8 ignore else -- TODO: add test #40625
        if (result !== null) {
          return result;
        }
      }
      return null;
    }
    // We can specify core, asdf, vfox, aqua backends for tools in the default registry
    // e.g. 'core:rust', 'asdf:rust', 'vfox:clang', 'aqua:act'
    case 'core':
      return getConfigFromTooling(miseTooling, toolName, version, toolOptions);
    case 'asdf':
      return getConfigFromTooling(asdfTooling, toolName, version, toolOptions);
    case 'vfox':
      return getRegistryToolConfig(toolName, version, toolOptions);
    case 'aqua':
      return (
        getRegistryToolConfig(toolName, version, toolOptions) ??
        createAquaToolConfig(toolName, version)
      );
    case 'cargo':
      return createCargoToolConfig(toolName, version);
    case 'dotnet':
      return createDotnetToolConfig(toolName);
    case 'gem':
      return createGemToolConfig(toolName);
    case 'github':
      return createGithubToolConfig(toolName, version, toolOptions);
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
  toolOptions: MiseToolOptions,
): StaticTooling | null {
  // Try to get the config from miseTooling first, then asdfTooling
  return (
    getConfigFromTooling(miseTooling, short, version, toolOptions) ??
    getConfigFromTooling(asdfTooling, short, version, toolOptions)
  );
}

function getConfigFromTooling(
  toolingSource: Record<string, ToolingDefinition>,
  name: string,
  version: string,
  toolOptions: MiseToolOptions,
): StaticTooling | null {
  const toolDefinition = toolingSource[name];
  if (!toolDefinition) {
    return null;
  } // Return null if no toolDefinition is found

  return (
    (isFunction(toolDefinition.config)
      ? toolDefinition.config(version, toolOptions)
      : toolDefinition.config) ?? null
  ); // Ensure null is returned instead of undefined
}

function extractToolEntry(name: string, toolData: MiseTool): PackageDependency {
  const { name: depName, options: optionsInName } = optionInToolNameRegex.exec(
    name.trim(),
  )!.groups!;
  const delimiterIndex = depName.indexOf(':');
  const backend = depName.substring(0, delimiterIndex);
  const toolName = depName.substring(delimiterIndex + 1);
  const spec = parseVersion(toolData);
  if (!spec) {
    return createDependency(depName, null, null);
  }
  const options = parseOptions(optionsInName, spec.options);
  const toolConfig = getToolConfig(backend, toolName, spec.version, options);
  return createDependency(depName, spec.version, toolConfig);
}

function createDependency(
  name: string,
  version: string | null,
  config: StaticTooling | BackendToolingConfig | null,
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

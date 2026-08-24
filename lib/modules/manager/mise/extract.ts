import {
  isArray,
  isFunction,
  isNonEmptyObject,
  isNonEmptyString,
  isObject,
  isString,
} from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { JavaVersionDatasource } from '../../datasource/java-version/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
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
const nonVersionSelectorRegex = regEx(/^(?:ref:|path:|sub-\d+(?::|$))/);
const partialSelectorRegex = regEx(
  /^(?<prefix>[^\d]*)(?<major>\d+)(?:\.(?<minor>\d+))?$/,
);
const versionPrefixRegex = regEx(/^(?<prefix>[^\d]*)\d/);

type MiseDependency = PackageDependency & { depName: string };

interface MiseSelectorConfig {
  allowedVersions?: string;
  ignoreUnstable?: boolean;
}

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

  const toolEntries: [string, MiseTool, string][] = [];

  for (const [name, toolData] of Object.entries(misefile.tools)) {
    toolEntries.push([name, toolData, 'tools']);
  }

  for (const [taskName, taskData] of Object.entries(misefile.tasks)) {
    for (const [name, toolData] of Object.entries(taskData.tools ?? {})) {
      toolEntries.push([name, toolData, `task-${taskName}-tools`]);
    }
  }

  if (!toolEntries.length) {
    return null;
  }

  const lockFileName = getLockFileName(packageFile);
  const lockFileContent = await readLocalFile(lockFileName, 'utf8');
  let lockFileData: MiseLockFile | undefined;
  if (lockFileContent) {
    const lockFileParsed = MiseLockFile.safeParse(lockFileContent);
    if (lockFileParsed.success) {
      lockFileData = lockFileParsed.data;
    } else {
      logger.debug(
        { lockFileName, error: lockFileParsed.error },
        'Failed to parse mise lock file',
      );
    }
  }

  const deps = toolEntries.map(([name, toolData, depType]) =>
    extractToolEntry(name, toolData, depType, lockFileData),
  );
  const result: PackageFileContent = { deps };

  if (lockFileData) {
    result.lockFiles = [lockFileName];
  }

  return result;
}

function parseVersion(toolData: MiseTool): string | null {
  if (isNonEmptyString(toolData)) {
    // Handle the string case
    // e.g. 'erlang = "23.3"'
    return toolData;
  }
  if (isArray(toolData, isString)) {
    // Handle the array case
    // e.g. 'erlang = ["23.3", "24.0"]'
    return toolData.length ? toolData[0] : null; // Get the first version in the array
  }
  if (isObject(toolData) && isNonEmptyString(toolData.version)) {
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
      const staticResult = getRegistryToolConfig(toolName, version);
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
): StaticTooling | null {
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
): StaticTooling | null {
  const toolDefinition = toolingSource[name];
  if (!toolDefinition) {
    return null;
  } // Return null if no toolDefinition is found

  return (
    (isFunction(toolDefinition.config)
      ? toolDefinition.config(version)
      : toolDefinition.config) ?? null
  ); // Ensure null is returned instead of undefined
}

function getLtsDatasource(
  backend: string,
  toolName: string,
  datasource: string | undefined,
): string | undefined {
  if (datasource) {
    return datasource;
  }
  if ((backend === '' || backend === 'core') && toolName === 'java') {
    return JavaVersionDatasource.id;
  }
  return undefined;
}

function getSelectorConfig(
  version: string,
  backend: string,
  toolName: string,
  datasource: string | undefined,
  lockedVersion: string,
): MiseSelectorConfig | null {
  if (version === 'latest') {
    return {};
  }

  if (version === 'lts') {
    const ltsDatasource = getLtsDatasource(backend, toolName, datasource);
    if (ltsDatasource === NodeVersionDatasource.id) {
      return { ignoreUnstable: true };
    }
    if (ltsDatasource === JavaVersionDatasource.id) {
      return {
        // Update this list when the OpenJDK release roadmap designates a new LTS.
        allowedVersions: '/^(?:8|11|17|21|25)(?:\\.|-|\\+|$)/',
        ignoreUnstable: true,
      };
    }
    return null;
  }

  if (nonVersionSelectorRegex.test(version)) {
    return null;
  }

  const match = partialSelectorRegex.exec(version);
  if (!match?.groups || lockedVersion === version) {
    return null;
  }

  const { prefix, major, minor } = match.groups;
  const lockedPrefix = versionPrefixRegex.exec(lockedVersion)?.groups?.prefix;
  const effectivePrefix = prefix || lockedPrefix;
  let prefixPattern = '';
  if (effectivePrefix) {
    prefixPattern = `(?:${RegExp.escape(effectivePrefix)})?`;
  } else if (datasource === GithubReleasesDatasource.id) {
    prefixPattern = `(?:${RegExp.escape('v')})?`;
  }
  const precisionPattern = minor
    ? `\\.${minor}(?:\\.|-|\\+|$)`
    : `(?:\\.|-|\\+|$)`;
  return {
    allowedVersions: `/^${prefixPattern}${major}${precisionPattern}/`,
  };
}

function extractSelectorLockedDependency(
  depName: string,
  version: string,
  backend: string,
  toolName: string,
  options: MiseToolOptions,
  toolConfig: StaticTooling | BackendToolingConfig | null,
  lockedVersion: string,
  depType: string,
): PackageDependency | null {
  const selectorConfig = getSelectorConfig(
    version,
    backend,
    toolName,
    toolConfig?.datasource,
    lockedVersion,
  );
  if (!selectorConfig) {
    return null;
  }

  const resolvedToolConfig = getToolConfig(
    backend,
    toolName,
    lockedVersion,
    options,
  );
  if (!resolvedToolConfig) {
    return null;
  }

  const comparableLockedVersion =
    resolvedToolConfig.currentValue ?? lockedVersion;
  return {
    ...createDependency(depName, version, resolvedToolConfig, depType),
    currentValue: comparableLockedVersion,
    lockedVersion: comparableLockedVersion,
    rangeStrategy: 'update-lockfile',
    isLockfileOnly: true,
    ...selectorConfig,
  };
}

function extractToolEntry(
  name: string,
  toolData: MiseTool,
  depType: string,
  lockFileData?: MiseLockFile,
): PackageDependency {
  const version = parseVersion(toolData);
  const { name: depName, options: optionsInName } = optionInToolNameRegex.exec(
    name.trim(),
  )!.groups!;
  const delimiterIndex = depName.indexOf(':');
  const backend = depName.substring(0, delimiterIndex);
  const toolName = depName.substring(delimiterIndex + 1);
  const options = parseOptions(
    optionsInName,
    isNonEmptyObject(toolData) ? toolData : {},
  );
  const toolConfig =
    version === null
      ? null
      : getToolConfig(backend, toolName, version, options);
  const dependency = createDependency(depName, version, toolConfig, depType);
  const lockedVersion = lockFileData
    ? getLockedVersion(lockFileData, dependency.depName)
    : undefined;

  if (version !== null && lockedVersion) {
    const selectorDependency = extractSelectorLockedDependency(
      depName,
      version,
      backend,
      toolName,
      options,
      toolConfig,
      lockedVersion,
      depType,
    );
    if (selectorDependency) {
      return selectorDependency;
    }
  }

  if (lockedVersion) {
    return { ...dependency, lockedVersion };
  }
  return dependency;
}

function getConfiguredDepName(
  config: StaticTooling | BackendToolingConfig,
): string | undefined {
  if ('depName' in config) {
    return config.depName;
  }
  return undefined;
}

function createDependency(
  name: string,
  version: string | null,
  config: StaticTooling | BackendToolingConfig | null,
  depType: string,
): MiseDependency {
  if (version === null) {
    return {
      depName: name,
      depType,
      skipReason: 'unspecified-version',
    };
  }
  if (config === null) {
    return {
      depName: name,
      depType,
      skipReason: 'unsupported-datasource',
    };
  }

  return {
    depType,
    currentValue: version,
    ...config,
    // Allow tooling definitions to override the parsed mise tool name.
    depName: getConfiguredDepName(config) ?? name,
  };
}

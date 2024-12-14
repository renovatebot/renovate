import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { CrateDatasource } from '../../datasource/crate';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GoDatasource } from '../../datasource/go';
import { NpmDatasource } from '../../datasource/npm';
import { PypiDatasource } from '../../datasource/pypi';
import { normalizePythonDepName } from '../../datasource/pypi/common';
import type { ToolingConfig } from '../asdf/upgradeable-tooling';
import type { PackageDependency, PackageFileContent } from '../types';
import type { MiseToolOptionsSchema, MiseToolSchema } from './schema';
import type { ToolingDefinition } from './upgradeable-tooling';
import { asdfTooling, miseTooling } from './upgradeable-tooling';
import { parseTomlFile } from './utils';

// Tool names can have options in the tool name
// e.g. ubi:tamasfe/taplo[matching=full,exe=taplo]
const optionInToolNameRegex = regEx(/^(?<name>.+)(?:\[(?<options>.+)\])?$/);

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
        optionInToolNameRegex.exec(name.trim())?.groups ?? {
          name: name.trim(),
        };
      const options = parseOptions(
        optionsInName,
        is.nonEmptyObject(toolData) ? toolData : {},
      );
      const toolConfig = getToolConfig(depName, version, options);
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

function parseOptions(
  optionsInName: string,
  toolOptions: MiseToolOptionsSchema,
): MiseToolOptionsSchema {
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

type SkippedToolingConfig = Partial<PackageDependency> &
  Required<Pick<PackageDependency, 'skipReason'>>;

function getToolConfig(
  name: string,
  version: string | null,
  toolOptions: MiseToolOptionsSchema,
): ToolingConfig | SkippedToolingConfig | null {
  if (version === null) {
    return null; // Early return if version is null
  }

  // If the tool name does not specify a backend, it should be a short name or an alias defined by users
  const delimiterIndex = name.indexOf(':');
  if (delimiterIndex === -1) {
    return getRegistryToolConfig(name, version);
  }

  const backend = name.substring(0, delimiterIndex);
  const toolName = name.substring(delimiterIndex + 1);
  switch (backend) {
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
        createAquaToolConfig(toolName)
      );
    case 'cargo':
      return createCargoToolConfig(toolName);
    case 'go':
      return createGoToolConfig(toolName);
    case 'npm':
      return createNpmToolConfig(toolName);
    case 'pipx':
      return createPipxToolConfig(toolName);
    case 'spm':
      return createSpmToolConfig(toolName);
    case 'ubi':
      return createUbiToolConfig(toolName, toolOptions);
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
    (typeof toolDefinition.config === 'function'
      ? toolDefinition.config(version)
      : toolDefinition.config) ?? null
  ); // Ensure null is returned instead of undefined
}

/**
 * Create a tooling config for aqua backend
 * @link https://mise.jdx.dev/dev-tools/backends/aqua.html
 */
function createAquaToolConfig(name: string): ToolingConfig {
  // mise supports http aqua package type but we cannot determine it from the tool name
  // An error will be thrown afterwards if the package type is http
  // ref: https://github.com/jdx/mise/blob/d1b9749d8f3e13ef705c1ea471d96c5935b79136/src/aqua/aqua_registry.rs#L39-L45
  return {
    packageName: name,
    datasource: GithubTagsDatasource.id,
  };
}

/**
 * Create a tooling config for cargo backend
 * @link https://mise.jdx.dev/dev-tools/backends/cargo.html
 */
function createCargoToolConfig(
  name: string,
): ToolingConfig | SkippedToolingConfig {
  // TODO: support url syntax
  // Avoid type narrowing to prevent type error
  if ((is.urlString as (value: unknown) => boolean)(name)) {
    return {
      packageName: name,
      skipReason: 'unsupported-url',
    };
  }
  return {
    packageName: name,
    datasource: CrateDatasource.id,
  };
}

/**
 * Create a tooling config for go backend
 * @link https://mise.jdx.dev/dev-tools/backends/go.html
 */
function createGoToolConfig(name: string): ToolingConfig {
  return {
    packageName: name,
    datasource: GoDatasource.id,
  };
}

/**
 * Create a tooling config for npm backend
 * @link https://mise.jdx.dev/dev-tools/backends/npm.html
 */
function createNpmToolConfig(name: string): ToolingConfig {
  return {
    packageName: name,
    datasource: NpmDatasource.id,
  };
}

const pipxGitHubRegex = regEx(/^git\+https:\/\/github\.com\/(?<repo>.+)\.git$/);

/**
 * Create a tooling config for pipx backend
 * @link https://mise.jdx.dev/dev-tools/backends/pipx.html
 */
function createPipxToolConfig(
  name: string,
): ToolingConfig | SkippedToolingConfig {
  const isGitSyntax = name.startsWith('git+');
  // Does not support zip file url
  // Avoid type narrowing to prevent type error
  if (!isGitSyntax && (is.urlString as (value: unknown) => boolean)(name)) {
    return {
      packageName: name,
      skipReason: 'unsupported-url',
    };
  }
  if (isGitSyntax || name.includes('/')) {
    let repoName: string | undefined;
    if (isGitSyntax) {
      repoName = pipxGitHubRegex.exec(name)?.groups?.repo;
      // mise only supports specifying the version tag for github repos
      if (is.undefined(repoName)) {
        return {
          packageName: name,
          skipReason: 'unsupported-url',
        };
      }
    } else {
      repoName = name;
    }
    return {
      packageName: repoName,
      datasource: GithubTagsDatasource.id,
    };
  }
  return {
    packageName: normalizePythonDepName(name),
    datasource: PypiDatasource.id,
  };
}

const spmGitHubRegex = regEx(/^https:\/\/github.com\/(?<repo>.+).git$/);

/**
 * Create a tooling config for spm backend
 * @link https://mise.jdx.dev/dev-tools/backends/spm.html
 */
function createSpmToolConfig(
  name: string,
): ToolingConfig | SkippedToolingConfig {
  let repoName: string | undefined;
  // Avoid type narrowing to prevent type error
  if ((is.urlString as (value: unknown) => boolean)(name)) {
    repoName = spmGitHubRegex.exec(name)?.groups?.repo;
    // spm backend only supports github repos
    if (!repoName) {
      return {
        packageName: name,
        skipReason: 'unsupported-url',
      };
    }
  }
  return {
    packageName: repoName ?? name,
    datasource: GithubReleasesDatasource.id,
  };
}

/**
 * Create a tooling config for ubi backend
 * @link https://mise.jdx.dev/dev-tools/backends/ubi.html
 */
function createUbiToolConfig(
  name: string,
  toolOptions: MiseToolOptionsSchema,
): ToolingConfig {
  return {
    packageName: name,
    datasource: GithubReleasesDatasource.id,
    ...(toolOptions.tag_regex
      ? {
          // Filter versions by tag_regex if it is specified
          // ref: https://mise.jdx.dev/dev-tools/backends/ubi.html#ubi-uses-weird-versions
          extractVersion: `(?<version>${toolOptions.tag_regex})`,
        }
      : {}),
  };
}

function createDependency(
  name: string,
  version: string | null,
  config: ToolingConfig | SkippedToolingConfig | null,
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

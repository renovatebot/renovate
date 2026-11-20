import {
  getSupportedToolNames,
  getToolConfig,
} from '../../../util/exec/containerbase.ts';
import type { ToolName } from '../../../util/exec/types.ts';
import { regEx } from '../../../util/regex.ts';
import { matchRegexOrGlob } from '../../../util/string-match.ts';
import { get as getVersioning } from '../../versioning/index.ts';
import type { VersioningApi } from '../../versioning/types.ts';
import type { SharedConstraintsScope } from '../types.ts';
import {
  confDLocation,
  configFileLocations,
  getConfigFilePattern,
} from './config-files.ts';
import { getConfigType } from './lockfile.ts';
import { getOrderedMiseRegistryBackends } from './upgradeable-tooling.ts';

/**
 * mise short names which differ from the Containerbase tool name.
 */
const toolNameAliases = new Map<string, ToolName>([
  ['flux2', 'flux'],
  ['go', 'golang'],
  ['nodejs', 'node'],
]);

/**
 * The Containerbase tools Renovate can install, by their mise short name.
 */
const toolNames = new Map<string, ToolName>([
  ...getSupportedToolNames().map((name): [string, ToolName] => [name, name]),
  ...toolNameAliases,
]);

/**
 * Backends whose tool names are short names of the mise registry, e.g. `core:node`.
 */
const shortNameBackends = new Set(['', 'core', 'asdf', 'vfox']);

/**
 * The Containerbase tools by the backend names the mise registry lists for them, e.g. `npm:pnpm` or `aqua:astral-sh/uv`.
 */
const backendConstraintNames = new Map<string, ToolName>();
for (const [shortName, toolName] of toolNames) {
  const backends = Object.entries(
    getOrderedMiseRegistryBackends(shortName),
  ).map(([backend, name]) => `${backend}:${name}`);
  for (const backend of backends) {
    backendConstraintNames.set(backend, toolName);
  }
}

const npmVersioning = getVersioning('npm');
const semverPartialVersioning = getVersioning('semver-partial');
// mise accepts a leading `v`, which Containerbase does not
const leadingVRegex = regEx(/^v/);

/**
 * The config file locations, those with most path segments first, as a file can match several, like `.config/mise.toml` and `mise.toml` in `.config`, and the longest one is meant.
 */
const configFiles = configFileLocations
  .map((location, index) => ({
    location,
    pattern: getConfigFilePattern(location),
    length: location.split('/').length,
    // the list is ordered by precedence, highest first
    precedence: configFileLocations.length - 1 - index,
  }))
  .sort((a, b) => b.length - a.length);

/**
 * Returns the constraint name of a mise tool, such as `pnpm` for `npm:pnpm`.
 */
export function getConstraintName(depName: string): ToolName | undefined {
  const delimiterIndex = depName.indexOf(':');
  const backend = depName.substring(0, delimiterIndex);
  const toolName = depName.substring(delimiterIndex + 1);
  const shortName = shortNameBackends.has(backend)
    ? toolNames.get(toolName)
    : undefined;
  return shortName ?? backendConstraintNames.get(depName);
}

/**
 * Returns the mise version of a tool as a constraint, or `null` unless it is a full version or a partial version which the tool versioning reads as a range.
 */
export function getConstraintValue(
  constraintName: ToolName,
  version: string | null | undefined,
): string | null {
  if (!version) {
    return null;
  }
  const constraint = version.replace(leadingVRegex, '');
  if (isFullVersion(constraint)) {
    return constraint;
  }
  // mise matches a partial version like `20` as a prefix, unlike a versioning which reads it as a single version, like python `3.12`
  const versioning = getVersioning(getToolConfig(constraintName)?.versioning);
  return isPartialVersion(constraint) && isRange(versioning, constraint)
    ? constraint
    : null;
}

/**
 * Whether `version` is a full version like `20.11.0`, without a build like `-otp-27`, which Containerbase does not install.
 */
function isFullVersion(version: string): boolean {
  return (
    semverPartialVersioning.isVersion(version) &&
    semverPartialVersioning.isStable(version)
  );
}

/**
 * Whether `version` is a partial version like `20` or `20.11`, which mise matches as a prefix.
 */
function isPartialVersion(version: string): boolean {
  return isRange(npmVersioning, version);
}

/**
 * Whether mise uses `lockedVersion` for the configured `version`, which for a version number it only does if the locked version matches it, as a prefix for a partial version.
 */
export function isLockedVersionOf(
  lockedVersion: string,
  version: string | null,
): boolean {
  return (
    !version ||
    !npmVersioning.isValid(version) ||
    semverPartialVersioning.matches(lockedVersion, version)
  );
}

function isRange(versioning: VersioningApi, version: string): boolean {
  return versioning.isValid(version) && !versioning.isSingleVersion(version);
}

/**
 * Returns the directory a mise config file applies to and its precedence within that directory, or `null` for a config file of an environment like `mise.production.toml`.
 */
export function getSharedConstraintsScope(
  packageFile: string,
): Omit<SharedConstraintsScope, 'constraints'> | null {
  const configFile = configFiles.find(({ pattern }) =>
    matchRegexOrGlob(packageFile, pattern),
  );
  if (!configFile) {
    return null;
  }
  const { location, length, precedence } = configFile;
  // the part matched by the leading `**/`
  const directory = packageFile.split('/').slice(0, -length).join('/');
  // mise loads every `conf.d` file, whatever its name, with the precedence of `conf.d`
  if (location === confDLocation) {
    return { directory, precedence };
  }
  const { isLocal, env } = getConfigType(packageFile);
  if (env) {
    return null;
  }
  return {
    directory,
    // a local config file overrides every shared one of the same directory
    precedence: isLocal ? precedence + configFileLocations.length : precedence,
  };
}

import {
  getSupportedToolNames,
  getToolConfig,
} from '../../../util/exec/containerbase.ts';
import type { ToolName } from '../../../util/exec/types.ts';
import { regEx } from '../../../util/regex.ts';
import { matchRegexOrGlob } from '../../../util/string-match.ts';
import { get as getVersioning } from '../../versioning/index.ts';
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

// a suffix like `-otp-27` names a build which Containerbase does not install, only build metadata like `+13` is kept
const versionRegex = regEx(
  /^v?(?<version>\d+(?:\.\d+)*(?:\+[0-9A-Za-z.+-]+)?)$/,
);
const fullVersionRegex = regEx(/^\d+\.\d+\.\d+/);

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
 * Returns the mise version of a tool as a constraint, or `null` unless the tool versioning reads it as a full version or a range.
 */
export function getConstraintValue(
  constraintName: ToolName,
  version: string | null | undefined,
): string | null {
  const constraint = versionRegex.exec(version ?? '')?.groups?.version;
  if (!constraint) {
    return null;
  }
  const versioning = getVersioning(getToolConfig(constraintName)?.versioning);
  if (!versioning.isValid(constraint)) {
    return null;
  }
  // mise matches a partial version like `20` as a prefix, unlike a versioning which reads it as a single version
  if (
    versioning.isSingleVersion(constraint) &&
    !fullVersionRegex.test(constraint)
  ) {
    return null;
  }
  return constraint;
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

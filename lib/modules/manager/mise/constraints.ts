import {
  getSupportedToolNames,
  getToolConfig,
} from '../../../util/exec/containerbase.ts';
import type { ToolName } from '../../../util/exec/types.ts';
import { regEx } from '../../../util/regex.ts';
import { get as getVersioning } from '../../versioning/index.ts';
import type { SharedConstraintsScope } from '../types.ts';
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

const versionRegex = regEx(
  /^v?(?<version>\d+(?:\.\d+)*(?:[-+][0-9A-Za-z.+-]+)?)$/,
);
const fullVersionRegex = regEx(/^\d+\.\d+\.\d+/);

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
 * Returns the mise version of a tool as a constraint, or `null` if the tool versioning cannot read it.
 *
 * mise matches partial versions like `20` as a prefix, so they are only used where the tool versioning reads them as a range.
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
  if (
    versioning.isSingleVersion(constraint) &&
    !fullVersionRegex.test(constraint)
  ) {
    return null;
  }
  return constraint;
}

/**
 * Config file locations relative to the directory they apply to, lowest precedence first.
 *
 * @see https://mise.jdx.dev/configuration.html
 */
const configLocations = [
  '.rtx',
  '.config/mise/conf.d',
  '.config/mise/config',
  '.config/mise/mise',
  '.config/mise',
  '.mise/config',
  'mise/config',
  'mise',
  '.mise',
];

const configFileRegex = regEx(
  /^(?<directory>.*?)\/(?:(?<confd>\.config\/mise\/conf\.d)\/[^/]+|(?<location>\.config\/mise\/(?:mise|config)|\.config\/mise|\.?mise\/config|\.?mise|\.rtx))(?:\.[^/]+)?\.toml$/,
);

/**
 * Returns the directory a mise config file applies to, and its precedence within that directory.
 *
 * Config files of an environment, like `mise.production.toml`, are only used when that environment is selected, so they return `null`.
 */
export function getSharedConstraintsScope(
  packageFile: string,
): SharedConstraintsScope | null {
  const { isLocal, env } = getConfigType(packageFile);
  const groups = configFileRegex.exec(`/${packageFile}`)?.groups;
  if (env || !groups) {
    return null;
  }
  const precedence = configLocations.indexOf(groups.location ?? groups.confd);
  return {
    directory: groups.directory.substring(1),
    // a local config file overrides every shared one of the same directory
    precedence: isLocal ? precedence + configLocations.length : precedence,
  };
}

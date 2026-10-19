import {
  type ToolMetadata,
  type ToolType,
  tools,
} from '@renovatebot/base-image';
import { isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import { GlobalConfig } from '../../config/global.ts';
import { logger } from '../../logger/index.ts';
import type { ReleaseResult } from '../../modules/datasource/index.ts';
import type { VersioningApi } from '../../modules/versioning/types.ts';
import type { VersioningName } from '../../versioning-list.generated.ts';
import { coerceArray } from '../array.ts';
import * as memCache from '../cache/memory/index.ts';
import { buildCacheKey } from '../cache/package/key.ts';
import { getEnv } from '../env.ts';
import { regEx } from '../regex.ts';
import {
  type ConstraintName,
  type Opt,
  type ToolConfig,
  type ToolConstraint,
  type ToolName,
  isToolName,
} from './types.ts';

/**
 * The Containerbase tools whose versions are looked up with the `containerbase` datasource.
 */
const containerbaseTools: readonly ToolName[] = [
  'apm',
  'bazelisk',
  'bun',
  'bundler',
  'cocoapods',
  'composer',
  'conan',
  'copier',
  'corepack',
  'dart',
  'deno',
  'devbox',
  'dotnet',
  'elixir',
  'erlang',
  'flutter',
  'flux',
  'gh',
  'gleam',
  'golang',
  'gradle',
  'hashin',
  'helm',
  'helmfile',
  'java',
  'jb',
  'kustomize',
  'maven',
  'mise',
  'nix',
  'node',
  'npm',
  'pdm',
  'php',
  'pip-tools',
  'pipenv',
  'pixi',
  'pnpm',
  'poetry',
  'python',
  'ruby',
  'uv',
  'vendir',
  'yarn',
  'yarn-slim',
];

/**
 * The versioning of the tools which a package manager installs, by its type.
 */
const typeVersioning: Record<ToolType, VersioningName> = {
  dotnet: 'nuget',
  gem: 'ruby',
  npm: 'npm',
  pip: 'pep440',
};

/**
 * The tools whose versions or constraints need another versioning than `npm`
 * or the one of their type.
 */
const toolVersioning: Partial<Record<ToolName, VersioningName>> = {
  composer: 'composer',
  deno: 'deno',
  erlang: 'semver-coerced',
  gradle: 'gradle',
  maven: 'maven',
  node: 'node',
  php: 'composer',
  pixi: 'conda',
  python: 'python',
  ruby: 'ruby',
};

/**
 * Returns the versioning of a tool: its own one, the one of its type, or `npm`.
 */
export function getToolVersioning(toolName: ToolName): VersioningName {
  const { type }: ToolMetadata = tools[toolName];
  return toolVersioning[toolName] ?? (type ? typeVersioning[type] : 'npm');
}

/**
 * Builds the lookup config of each supported tool, `rust` keeps its own datasource.
 */
function getAllToolConfig(): Partial<Record<ToolName, ToolConfig>> {
  const toolConfig: Partial<Record<ToolName, ToolConfig>> = {
    // the `containerbase` datasource has no nightly releases, which `install-tool` also installs
    rust: {
      datasource: 'rust-version',
      packageName: 'rust',
      versioning: 'rust-release-channel',
    },
  };
  for (const toolName of containerbaseTools) {
    toolConfig[toolName] = {
      datasource: 'containerbase',
      packageName: toolName,
      versioning: getToolVersioning(toolName),
    };
  }
  return toolConfig;
}

/**
 * A subset of Containerbase tools that are supported by Renovate to look up version numbers for.
 */
export const allToolConfig = getAllToolConfig();

/**
 * All Containerbase `tool`s that Renovate supports configuring the version of.
 */
export function getSupportedToolNames(): readonly ToolName[] {
  return Object.keys(allToolConfig) as readonly ToolName[];
}

let _getPkgReleases: Promise<
  typeof import('../../modules/datasource/index.ts')
> | null = null;

async function getPkgReleases(
  toolConfig: ToolConfig,
  resolvedTools: Partial<Record<ConstraintName, string>> = {},
): Promise<ReleaseResult | null> {
  _getPkgReleases ??= import('../../modules/datasource/index.ts');
  const { getPkgReleases } = await _getPkgReleases;
  if (Object.keys(resolvedTools).length) {
    // drop releases whose runtime constraints (e.g. `engines.node`) exclude the runtime versions we install
    const compatible = await getPkgReleases({
      ...toolConfig,
      constraintsFiltering: 'strict',
      constraints: { ...resolvedTools },
    });
    if (compatible?.releases.length) {
      return compatible;
    }
    logger.debug(
      { toolConfig, resolvedTools },
      'No tool releases compatible with resolved tools - ignoring their constraints',
    );
  }
  return getPkgReleases(toolConfig);
}

export function getToolConfig(toolName: ToolName): ToolConfig | undefined {
  return allToolConfig[toolName];
}

export function supportsDynamicInstall(toolName: ToolName): boolean {
  return !!allToolConfig[toolName];
}

export function isContainerbase(): boolean {
  return !!getEnv().CONTAINERBASE;
}

export function isDynamicInstall(
  toolConstraints?: Opt<ToolConstraint[]>,
): boolean {
  if (GlobalConfig.get('binarySource') !== 'install') {
    return false;
  }
  if (!isContainerbase()) {
    logger.debug('Falling back to binarySource=global');
    return false;
  }
  return (
    !toolConstraints ||
    toolConstraints.every((toolConstraint) =>
      supportsDynamicInstall(toolConstraint.toolName),
    )
  );
}

function isStable(
  version: string,
  versioningApi: VersioningApi,
  latest?: string,
): boolean {
  if (!versioningApi.isStable(version)) {
    return false;
  }
  if (isString(latest) && versioningApi.isGreaterThan(version, latest)) {
    return false;
  }
  return true;
}

export async function resolveConstraint(
  toolConstraint: ToolConstraint,
  resolvedTools: Partial<Record<ConstraintName, string>> = {},
): Promise<string> {
  const { toolName } = toolConstraint;
  const toolConfig = allToolConfig[toolName];
  if (!toolConfig) {
    throw new Error(`Invalid tool to install: ${toolName}`);
  }

  const { get: getVersioning } =
    await import('../../modules/versioning/index.ts');
  const versioning = getVersioning(toolConfig.versioning);
  let constraint = toolConstraint.constraint;
  if (constraint) {
    if (versioning.isValid(constraint)) {
      if (versioning.isSingleVersion(constraint)) {
        return constraint.replace(regEx(/^=+/), '').trim();
      }
    } else {
      logger.warn(
        { toolName, constraint, versioning: toolConfig.versioning },
        'Invalid tool constraint',
      );
      constraint = undefined;
    }
  }

  const pkgReleases = await getPkgReleases(toolConfig, resolvedTools);
  const releases = coerceArray(pkgReleases?.releases);

  if (!releases?.length) {
    logger.warn({ toolConfig }, 'No tool releases found.');
    throw new Error('No tool releases found.');
  }

  const matchingReleases = releases.filter(
    (r) => !constraint || versioning.matches(r.version, constraint),
  );

  const stableMatchingVersion = matchingReleases
    .filter((r) => isStable(r.version, versioning, pkgReleases?.tags?.latest))
    .pop()?.version;
  if (stableMatchingVersion) {
    logger.debug(
      { toolName, constraint, resolvedVersion: stableMatchingVersion },
      'Resolved stable matching version',
    );
    return stableMatchingVersion;
  }

  const unstableMatchingVersion = matchingReleases.pop()?.version;
  if (unstableMatchingVersion) {
    logger.debug(
      { toolName, constraint, resolvedVersion: unstableMatchingVersion },
      'Resolved unstable matching version',
    );
    return unstableMatchingVersion;
  }

  const stableVersion = releases
    .filter((r) => isStable(r.version, versioning, pkgReleases?.tags?.latest))
    .pop()?.version;
  if (stableVersion) {
    logger.warn(
      { toolName, constraint, stableVersion },
      'No matching tool versions found for constraint - using latest stable version',
    );
  }

  const highestVersion = releases.pop()!.version;
  logger.warn(
    { toolName, constraint, highestVersion },
    'No matching or stable tool versions found - using an unstable version',
  );
  return highestVersion;
}

// Docker execs run in a fresh `--rm` container each time, so `memoize` must
// stay false there - only the persistent-host (binarySource=install) path
// can safely skip a tool whose requested version is already active.
// `install-tool` also activates the version it installs, so the memo tracks
// the active version per tool, not every installed version.
export async function generateInstallCommands(
  toolConstraints: Opt<ToolConstraint[]>,
  memoize = false,
): Promise<string[]> {
  const installCommands: string[] = [];
  if (toolConstraints?.length) {
    // Parents are listed before their tools (e.g. node before npm),
    // so a tool is matched against its parent's already resolved version.
    const resolvedTools: Partial<Record<ToolName, string>> = {};
    for (const toolConstraint of toolConstraints) {
      const { toolName } = toolConstraint;
      const { parent }: ToolMetadata = tools[toolName];
      const parentConstraint: Partial<Record<ConstraintName, string>> = {};
      if (isToolName(parent) && resolvedTools[parent]) {
        parentConstraint[parent] = resolvedTools[parent];
      }
      const toolVersion = await resolveConstraint(
        toolConstraint,
        parentConstraint,
      );
      resolvedTools[toolName] = toolVersion;
      if (memoize) {
        const cacheKey = buildCacheKey('containerbase-active', toolName);
        if (memCache.get<string | undefined>(cacheKey) === toolVersion) {
          continue;
        }
        memCache.set(cacheKey, toolVersion);
      }
      const installCommand = `install-tool ${toolName} ${quote(toolVersion)}`;
      installCommands.push(installCommand);
    }
  }
  return installCommands;
}

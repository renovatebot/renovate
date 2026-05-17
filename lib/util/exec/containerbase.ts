import { isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import { GlobalConfig } from '../../config/global.ts';
import { logger } from '../../logger/index.ts';
import type { ReleaseResult } from '../../modules/datasource/index.ts';
import type { VersioningApi } from '../../modules/versioning/types.ts';
import { getEnv } from '../env.ts';
import type { Opt, ToolConfig, ToolConstraint, ToolName } from './types.ts';

export const allToolConfig: Record<ToolName, ToolConfig> = {
  bazelisk: {
    datasource: 'github-releases',
    packageName: 'bazelbuild/bazelisk',
    versioning: 'semver',
  },
  bun: {
    datasource: 'github-releases',
    packageName: 'oven-sh/bun',
    extractVersion: '^bun-v(?<version>.*)$',
    versioning: 'npm',
  },
  bundler: {
    datasource: 'rubygems',
    packageName: 'bundler',
    versioning: 'ruby',
  },
  cocoapods: {
    datasource: 'rubygems',
    packageName: 'cocoapods',
    versioning: 'ruby',
  },
  composer: {
    datasource: 'github-releases',
    packageName: 'containerbase/composer-prebuild',
    versioning: 'composer',
  },
  conan: {
    datasource: 'pypi',
    packageName: 'conan',
    versioning: 'pep440',
  },
  copier: {
    datasource: 'pypi',
    packageName: 'copier',
    versioning: 'pep440',
  },
  corepack: {
    datasource: 'npm',
    packageName: 'corepack',
    versioning: 'npm',
  },
  deno: {
    datasource: 'github-releases',
    packageName: 'denoland/deno',
    versioning: 'deno',
  },
  devbox: {
    datasource: 'github-releases',
    packageName: 'jetify-com/devbox',
    versioning: 'semver',
  },
  dotnet: {
    datasource: 'dotnet-version',
    packageName: 'dotnet-sdk',
    versioning: 'semver',
  },
  erlang: {
    datasource: 'github-releases',
    packageName: 'containerbase/erlang-prebuild',
    versioning: 'semver-coerced',
  },
  elixir: {
    datasource: 'github-releases',
    packageName: 'elixir-lang/elixir',
    versioning: 'semver',
  },
  flux: {
    datasource: 'github-releases',
    packageName: 'fluxcd/flux2',
    versioning: 'semver',
  },
  gleam: {
    datasource: 'github-releases',
    packageName: 'gleam-lang/gleam',
    versioning: 'semver',
  },
  golang: {
    datasource: 'github-releases',
    packageName: 'containerbase/golang-prebuild',
    versioning: 'npm',
  },
  gradle: {
    datasource: 'gradle-version',
    packageName: 'gradle',
    versioning: 'gradle',
  },
  hashin: {
    datasource: 'pypi',
    packageName: 'hashin',
    versioning: 'pep440',
  },
  helm: {
    datasource: 'github-releases',
    packageName: 'helm/helm',
    versioning: 'semver',
  },
  helmfile: {
    datasource: 'github-releases',
    packageName: 'helmfile/helmfile',
    versioning: 'semver',
  },
  java: {
    datasource: 'java-version',
    packageName: 'java?system=true',
    versioning: 'npm',
  },
  /* not used in Renovate */
  'java-maven': {
    datasource: 'java-version',
    packageName: 'java?system=true',
    versioning: 'maven',
  },
  jb: {
    datasource: 'github-releases',
    packageName: 'jsonnet-bundler/jsonnet-bundler',
    versioning: 'semver',
  },
  kustomize: {
    datasource: 'github-releases',
    packageName: 'kubernetes-sigs/kustomize',
    extractVersion: '^kustomize/v(?<version>.*)$',
    versioning: 'semver',
  },
  maven: {
    datasource: 'github-releases',
    packageName: 'containerbase/maven-prebuild',
    versioning: 'maven',
  },
  nix: {
    datasource: 'github-releases',
    packageName: 'containerbase/nix-prebuild',
    versioning: 'semver',
  },
  node: {
    datasource: 'github-releases',
    packageName: 'containerbase/node-prebuild',
    versioning: 'node',
  },
  npm: {
    datasource: 'npm',
    packageName: 'npm',
    versioning: 'npm',
  },
  paket: {
    datasource: 'nuget',
    packageName: 'paket',
    versioning: semverVersioningId,
  },
  pdm: {
    datasource: 'github-releases',
    packageName: 'pdm-project/pdm',
    versioning: 'semver',
  },
  php: {
    datasource: 'github-releases',
    packageName: 'containerbase/php-prebuild',
    versioning: 'composer',
  },
  'pip-tools': {
    datasource: 'pypi',
    packageName: 'pip-tools',
    versioning: 'pep440',
  },
  pipenv: {
    datasource: 'pypi',
    packageName: 'pipenv',
    versioning: 'pep440',
  },
  pnpm: {
    datasource: 'npm',
    packageName: 'pnpm',
    versioning: 'npm',
  },
  pixi: {
    datasource: 'github-releases',
    packageName: 'prefix-dev/pixi',
    versioning: 'conda',
    extractVersion: '^v(?<version>.*)$',
  },
  poetry: {
    datasource: 'pypi',
    packageName: 'poetry',
    versioning: 'pep440',
  },
  python: {
    datasource: 'github-releases',
    packageName: 'containerbase/python-prebuild',
    versioning: 'python',
  },
  ruby: {
    datasource: 'github-releases',
    packageName: 'containerbase/ruby-prebuild',
    versioning: 'ruby',
  },
  rust: {
    datasource: 'docker',
    packageName: 'rust',
    versioning: 'semver',
  },
  uv: {
    datasource: 'pypi',
    packageName: 'uv',
    versioning: 'pep440',
  },
  yarn: {
    datasource: 'npm',
    packageName: 'yarn',
    versioning: 'npm',
  },
  'yarn-slim': {
    datasource: 'npm',
    packageName: 'yarn',
    versioning: 'npm',
  },
  dart: {
    datasource: 'dart-version',
    packageName: 'dart',
    versioning: 'npm',
  },
  flutter: {
    datasource: 'github-releases',
    packageName: 'containerbase/flutter-prebuild',
    versioning: 'npm',
  },
  vendir: {
    datasource: 'github-releases',
    packageName: 'carvel-dev/vendir',
    versioning: 'semver',
  },
} as const;

let _getPkgReleases: Promise<
  typeof import('../../modules/datasource/index.ts')
> | null = null;

async function getPkgReleases(
  toolConfig: ToolConfig,
): Promise<ReleaseResult | null> {
  _getPkgReleases ??= import('../../modules/datasource/index.ts');
  const { getPkgReleases } = await _getPkgReleases;
  return getPkgReleases(toolConfig);
}

export function getToolConfig(toolName: ToolName): ToolConfig {
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
  if (isString(latest)) {
    if (versioningApi.isGreaterThan(version, latest)) {
      return false;
    }
  }
  return true;
}

export async function resolveConstraint(
  toolConstraint: ToolConstraint,
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
        return constraint.replace(/^=+/, '').trim();
      }
    } else {
      logger.warn(
        { toolName, constraint, versioning: toolConfig.versioning },
        'Invalid tool constraint',
      );
      constraint = undefined;
    }
  }

  const pkgReleases = await getPkgReleases(toolConfig);
  const releases = pkgReleases?.releases ?? [];

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

export async function generateInstallCommands(
  toolConstraints: Opt<ToolConstraint[]>,
): Promise<string[]> {
  const installCommands: string[] = [];
  if (toolConstraints?.length) {
    for (const toolConstraint of toolConstraints) {
      const toolVersion = await resolveConstraint(toolConstraint);
      const { toolName } = toolConstraint;
      const installCommand = `install-tool ${toolName} ${quote(toolVersion)}`;
      installCommands.push(installCommand);
    }
  }
  return installCommands;
}

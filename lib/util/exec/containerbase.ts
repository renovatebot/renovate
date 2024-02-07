import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import type { ReleaseResult } from '../../modules/datasource';
import * as allVersioning from '../../modules/versioning';
import { id as composerVersioningId } from '../../modules/versioning/composer';
import { id as gradleVersioningId } from '../../modules/versioning/gradle';
import { id as mavenVersioningId } from '../../modules/versioning/maven';
import { id as nodeVersioningId } from '../../modules/versioning/node';
import { id as npmVersioningId } from '../../modules/versioning/npm';
import { id as pep440VersioningId } from '../../modules/versioning/pep440';
import { id as pythonVersioningId } from '../../modules/versioning/python';
import { id as rubyVersioningId } from '../../modules/versioning/ruby';
import { id as semverVersioningId } from '../../modules/versioning/semver';
import { id as semverCoercedVersioningId } from '../../modules/versioning/semver-coerced';
import type { Opt, ToolConfig, ToolConstraint } from './types';

const allToolConfig: Record<string, ToolConfig> = {
  bun: {
    datasource: 'github-releases',
    packageName: 'oven-sh/bun',
    extractVersion: '^bun-v(?<version>.*)$',
    versioning: npmVersioningId,
  },
  bundler: {
    datasource: 'rubygems',
    packageName: 'bundler',
    versioning: rubyVersioningId,
  },
  cocoapods: {
    datasource: 'rubygems',
    packageName: 'cocoapods',
    versioning: rubyVersioningId,
  },
  composer: {
    datasource: 'github-releases',
    packageName: 'composer/composer',
    versioning: composerVersioningId,
  },
  corepack: {
    datasource: 'npm',
    packageName: 'corepack',
    versioning: npmVersioningId,
  },
  dotnet: {
    datasource: 'dotnet-version',
    packageName: 'dotnet-sdk',
    versioning: semverVersioningId,
  },
  erlang: {
    datasource: 'github-releases',
    packageName: 'containerbase/erlang-prebuild',
    versioning: semverCoercedVersioningId,
  },
  elixir: {
    datasource: 'github-releases',
    packageName: 'elixir-lang/elixir',
    versioning: semverVersioningId,
  },
  flux: {
    datasource: 'github-releases',
    packageName: 'fluxcd/flux2',
    versioning: semverVersioningId,
  },
  golang: {
    datasource: 'golang-version',
    packageName: 'golang',
    versioning: npmVersioningId,
  },
  gradle: {
    datasource: 'gradle-version',
    packageName: 'gradle',
    versioning: gradleVersioningId,
  },
  hashin: {
    datasource: 'pypi',
    packageName: 'hashin',
    versioning: pep440VersioningId,
  },
  helm: {
    datasource: 'github-releases',
    packageName: 'helm/helm',
    versioning: semverVersioningId,
  },
  helmfile: {
    datasource: 'github-releases',
    packageName: 'helmfile/helmfile',
    versioning: semverVersioningId,
  },
  java: {
    datasource: 'java-version',
    packageName: 'java',
    versioning: npmVersioningId,
  },
  /* not used in Renovate */
  'java-maven': {
    datasource: 'java-version',
    packageName: 'java',
    versioning: mavenVersioningId,
  },
  jb: {
    datasource: 'github-releases',
    packageName: 'jsonnet-bundler/jsonnet-bundler',
    versioning: semverVersioningId,
  },
  kustomize: {
    datasource: 'github-releases',
    packageName: 'kubernetes-sigs/kustomize',
    extractVersion: '^kustomize/v(?<version>.*)$',
    versioning: semverVersioningId,
  },
  maven: {
    datasource: 'maven',
    packageName: 'org.apache.maven:maven',
    versioning: mavenVersioningId,
  },
  nix: {
    datasource: 'github-tags',
    packageName: 'NixOS/nix',
    versioning: semverVersioningId,
  },
  node: {
    datasource: 'node-version',
    packageName: 'node',
    versioning: nodeVersioningId,
  },
  npm: {
    datasource: 'npm',
    packageName: 'npm',
    hash: true,
    versioning: npmVersioningId,
  },
  pdm: {
    datasource: 'github-releases',
    packageName: 'pdm-project/pdm',
    versioning: semverVersioningId,
  },
  php: {
    datasource: 'github-releases',
    packageName: 'containerbase/php-prebuild',
    versioning: composerVersioningId,
  },
  'pip-tools': {
    datasource: 'pypi',
    packageName: 'pip-tools',
    versioning: pep440VersioningId,
  },
  pipenv: {
    datasource: 'pypi',
    packageName: 'pipenv',
    versioning: pep440VersioningId,
  },
  pnpm: {
    datasource: 'npm',
    packageName: 'pnpm',
    versioning: npmVersioningId,
  },
  poetry: {
    datasource: 'pypi',
    packageName: 'poetry',
    versioning: pep440VersioningId,
  },
  python: {
    datasource: 'github-releases',
    packageName: 'containerbase/python-prebuild',
    versioning: pythonVersioningId,
  },
  ruby: {
    datasource: 'github-releases',
    packageName: 'containerbase/ruby-prebuild',
    versioning: rubyVersioningId,
  },
  rust: {
    datasource: 'docker',
    packageName: 'rust',
    versioning: semverVersioningId,
  },
  yarn: {
    datasource: 'npm',
    packageName: 'yarn',
    versioning: npmVersioningId,
  },
  'yarn-slim': {
    datasource: 'npm',
    packageName: 'yarn',
    versioning: npmVersioningId,
  },
  dart: {
    datasource: 'dart-version',
    packageName: 'dart',
    versioning: npmVersioningId,
  },
  flutter: {
    datasource: 'flutter-version',
    packageName: 'flutter',
    versioning: npmVersioningId,
  },
  vendir: {
    datasource: 'github-releases',
    packageName: 'carvel-dev/vendir',
    versioning: semverVersioningId,
  },
};

let _getPkgReleases: Promise<typeof import('../../modules/datasource')> | null =
  null;

async function getPkgReleases(
  toolConfig: ToolConfig,
): Promise<ReleaseResult | null> {
  if (_getPkgReleases === null) {
    _getPkgReleases = import('../../modules/datasource');
  }
  const { getPkgReleases } = await _getPkgReleases;
  return getPkgReleases(toolConfig);
}

export function supportsDynamicInstall(toolName: string): boolean {
  return !!allToolConfig[toolName];
}

export function isContainerbase(): boolean {
  return !!process.env.CONTAINERBASE;
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
  versioning: allVersioning.VersioningApi,
  latest?: string,
): boolean {
  if (!versioning.isStable(version)) {
    return false;
  }
  if (is.string(latest)) {
    if (versioning.isGreaterThan(version, latest)) {
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

  const versioning = allVersioning.get(toolConfig.versioning);
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
      if (allToolConfig[toolName].hash) {
        installCommands.push(`hash -d ${toolName} 2>/dev/null || true`);
      }
    }
  }
  return installCommands;
}

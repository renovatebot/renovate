import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { getPkgReleases } from '../../modules/datasource';
import * as allVersioning from '../../modules/versioning';
import { id as composerVersioningId } from '../../modules/versioning/composer';
import { id as nodeVersioningId } from '../../modules/versioning/node';
import { id as npmVersioningId } from '../../modules/versioning/npm';
import { id as pep440VersioningId } from '../../modules/versioning/pep440';
import { id as pythonVersioningId } from '../../modules/versioning/python';
import { id as rubyVersioningId } from '../../modules/versioning/ruby';
import { id as semverVersioningId } from '../../modules/versioning/semver';
import { id as semverCoercedVersioningId } from '../../modules/versioning/semver-coerced';
import type { Opt, ToolConfig, ToolConstraint } from './types';

const allToolConfig: Record<string, ToolConfig> = {
  bundler: {
    datasource: 'rubygems',
    depName: 'bundler',
    versioning: 'ruby',
  },
  cocoapods: {
    datasource: 'rubygems',
    depName: 'cocoapods',
    versioning: rubyVersioningId,
  },
  composer: {
    datasource: 'github-releases',
    depName: 'composer/composer',
    versioning: composerVersioningId,
  },
  corepack: {
    datasource: 'npm',
    depName: 'corepack',
    versioning: npmVersioningId,
  },
  erlang: {
    datasource: 'github-releases',
    depName: 'containerbase/erlang-prebuild',
    versioning: semverCoercedVersioningId,
  },
  elixir: {
    datasource: 'github-releases',
    depName: 'elixir-lang/elixir',
    versioning: semverVersioningId,
  },
  flux: {
    datasource: 'github-releases',
    depName: 'fluxcd/flux2',
    versioning: semverVersioningId,
  },
  helm: {
    datasource: 'github-releases',
    depName: 'helm/helm',
    versioning: semverVersioningId,
  },
  java: {
    datasource: 'adoptium-java',
    depName: 'java',
    versioning: npmVersioningId,
  },
  jb: {
    datasource: 'github-releases',
    depName: 'jsonnet-bundler/jsonnet-bundler',
    versioning: semverVersioningId,
  },
  lerna: {
    datasource: 'npm',
    depName: 'lerna',
    versioning: npmVersioningId,
  },
  node: {
    datasource: 'node',
    depName: 'node',
    versioning: nodeVersioningId,
  },
  npm: {
    datasource: 'npm',
    depName: 'npm',
    hash: true,
    versioning: npmVersioningId,
  },
  pnpm: {
    datasource: 'npm',
    depName: 'pnpm',
    versioning: npmVersioningId,
  },
  poetry: {
    datasource: 'pypi',
    depName: 'poetry',
    versioning: pep440VersioningId,
  },
  python: {
    datasource: 'github-releases',
    depName: 'containerbase/python-prebuild',
    versioning: pythonVersioningId,
  },
  yarn: {
    datasource: 'npm',
    depName: 'yarn',
    versioning: npmVersioningId,
  },
  'yarn-slim': {
    datasource: 'npm',
    depName: 'yarn',
    versioning: npmVersioningId,
  },
};

export function supportsDynamicInstall(toolName: string): boolean {
  return !!allToolConfig[toolName];
}

export function isBuildpack(): boolean {
  return !!process.env.BUILDPACK;
}

export function isDynamicInstall(
  toolConstraints?: Opt<ToolConstraint[]>
): boolean {
  const { binarySource } = GlobalConfig.get();
  if (binarySource !== 'install') {
    return false;
  }
  if (!isBuildpack()) {
    logger.warn(
      'binarySource=install is only compatible with images derived from github.com/containerbase'
    );
    return false;
  }
  return (
    !toolConstraints ||
    toolConstraints.every((toolConstraint) =>
      supportsDynamicInstall(toolConstraint.toolName)
    )
  );
}

function isStable(
  version: string,
  versioning: allVersioning.VersioningApi,
  latest?: string
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
  toolConstraint: ToolConstraint
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
        return constraint;
      }
    } else {
      logger.warn({ toolName, constraint }, 'Invalid tool constraint');
      constraint = undefined;
    }
  }

  const pkgReleases = await getPkgReleases(toolConfig);
  const releases = pkgReleases?.releases ?? [];

  if (!releases?.length) {
    throw new Error('No tool releases found.');
  }

  const matchingReleases = releases.filter(
    (r) => !constraint || versioning.matches(r.version, constraint)
  );

  const stableMatchingVersion = matchingReleases
    .filter((r) => isStable(r.version, versioning, pkgReleases?.tags?.latest))
    .pop()?.version;
  if (stableMatchingVersion) {
    logger.debug(
      { toolName, constraint, resolvedVersion: stableMatchingVersion },
      'Resolved stable matching version'
    );
    return stableMatchingVersion;
  }

  const unstableMatchingVersion = matchingReleases.pop()?.version;
  if (unstableMatchingVersion) {
    logger.debug(
      { toolName, constraint, resolvedVersion: unstableMatchingVersion },
      'Resolved unstable matching version'
    );
    return unstableMatchingVersion;
  }

  const stableVersion = releases
    .filter((r) => isStable(r.version, versioning, pkgReleases?.tags?.latest))
    .pop()?.version;
  if (stableVersion) {
    logger.warn(
      { toolName, constraint, stableVersion },
      'No matching tool versions found for constraint - using latest stable version'
    );
  }

  const highestVersion = releases.pop()!.version;
  logger.warn(
    { toolName, constraint, highestVersion },
    'No matching or stable tool versions found - using an unstable version'
  );
  return highestVersion;
}

export async function generateInstallCommands(
  toolConstraints: Opt<ToolConstraint[]>
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

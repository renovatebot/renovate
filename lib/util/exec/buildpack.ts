import { quote } from 'shlex';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { getPkgReleases } from '../../modules/datasource';
import * as allVersioning from '../../modules/versioning';
import { id as composerVersioningId } from '../../modules/versioning/composer';
import { id as npmVersioningId } from '../../modules/versioning/npm';
import { id as pep440VersioningId } from '../../modules/versioning/pep440';
import { id as semverVersioningId } from '../../modules/versioning/semver';
import type { Opt, ToolConfig, ToolConstraint } from './types';

const allToolConfig: Record<string, ToolConfig> = {
  bundler: {
    datasource: 'rubygems',
    depName: 'bundler',
    versioning: 'ruby',
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
  jb: {
    datasource: 'github-releases',
    depName: 'jsonnet-bundler/jsonnet-bundler',
    versioning: semverVersioningId,
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
      'binarySource=install is only compatible with images derived from containerbase/buildpack'
    );
    return false;
  }
  return !!toolConstraints?.every((toolConstraint) =>
    supportsDynamicInstall(toolConstraint.toolName)
  );
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
  const versions = releases.map((r) => r.version);
  const resolvedVersion = versions
    .filter((v) =>
      constraint ? versioning.matches(v, constraint) : versioning.isStable(v)
    )
    .pop();

  if (resolvedVersion) {
    logger.debug({ toolName, constraint, resolvedVersion }, 'Resolved version');
    return resolvedVersion;
  }

  const latestVersion = versions.filter((v) => versioning.isStable(v)).pop();
  if (!latestVersion) {
    throw new Error('No tool releases found.');
  }
  logger.warn(
    { toolName, constraint, latestVersion },
    'No matching tool versions found for constraint - using latest version'
  );
  return latestVersion;
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

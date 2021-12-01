import { quote } from 'shlex';
import { getPkgReleases } from '../../datasource';
import { logger } from '../../logger';
import * as allVersioning from '../../versioning';
import { id as composerVersioningId } from '../../versioning/composer';
import { id as semverVersioningId } from '../../versioning/semver';
import type { ToolConfig, ToolConstraint } from './types';

const allToolConfig: Record<string, ToolConfig> = {
  composer: {
    datasource: 'github-releases',
    depName: 'composer/composer',
    versioning: composerVersioningId,
  },
  jb: {
    datasource: 'github-releases',
    depName: 'jsonnet-bundler/jsonnet-bundler',
    versioning: semverVersioningId,
  },
};

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
    .filter((v) => !constraint || versioning.matches(v, constraint))
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
  toolConstraints: ToolConstraint[]
): Promise<string[]> {
  const installCommands = [];
  if (toolConstraints?.length) {
    for (const toolConstraint of toolConstraints) {
      const toolVersion = await resolveConstraint(toolConstraint);
      const installCommand = `install-tool ${toolConstraint.toolName} ${quote(
        toolVersion
      )}`;
      installCommands.push(installCommand);
    }
  }
  return installCommands;
}

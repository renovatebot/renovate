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
  if (!pkgReleases?.releases?.length) {
    throw new Error('No tool releases found.');
  }

  const allVersions = pkgReleases.releases.map((r) => r.version);
  const matchingVersions = allVersions.filter(
    (v) => !constraint || versioning.matches(v, constraint)
  );

  if (matchingVersions.length) {
    const resolvedVersion = matchingVersions.pop();
    logger.debug({ toolName, constraint, resolvedVersion }, 'Resolved version');
    return resolvedVersion;
  }
  const latestVersion = allVersions.filter((v) => versioning.isStable(v)).pop();
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

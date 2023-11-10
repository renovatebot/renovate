// TODO: types (#22198)
import { quote } from 'shlex';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import type { HostRuleSearchResult } from '../../../types';
import type { ToolConstraint } from '../../../util/exec/types';
import { coerceNumber } from '../../../util/number';
import { api, id as composerVersioningId } from '../../versioning/composer';
import type { UpdateArtifactsConfig } from '../types';
import type { Lockfile, PackageFile } from './schema';

export { composerVersioningId };

const depRequireInstall = new Set(['symfony/flex']);

export function getComposerArguments(
  config: UpdateArtifactsConfig,
  toolConstraint: ToolConstraint,
): string {
  let args = '';

  if (config.composerIgnorePlatformReqs) {
    if (config.composerIgnorePlatformReqs.length === 0) {
      // TODO: toolConstraint.constraint can be null or undefined? (#22198)
      const major = api.getMajor(toolConstraint.constraint!);
      const minor = api.getMinor(toolConstraint.constraint!);
      args += api.matches(`${major}.${minor}`, '^2.2')
        ? " --ignore-platform-req='ext-*' --ignore-platform-req='lib-*'"
        : ' --ignore-platform-reqs';
    } else {
      config.composerIgnorePlatformReqs.forEach((req) => {
        args += ' --ignore-platform-req ' + quote(req);
      });
    }
  }

  args += ' --no-ansi --no-interaction';
  if (!GlobalConfig.get('allowScripts') || config.ignoreScripts) {
    args += ' --no-scripts --no-autoloader';
  }

  if (!GlobalConfig.get('allowPlugins') || config.ignorePlugins) {
    args += ' --no-plugins';
  }

  return args;
}

export function getPhpConstraint(
  constraints: Record<string, string>,
): string | null {
  const { php } = constraints;

  if (php) {
    logger.debug('Using php constraint from config');
    return php;
  }

  return null;
}

export function requireComposerDependencyInstallation({
  packages,
  packagesDev,
}: Lockfile): boolean {
  return (
    packages.some((p) => depRequireInstall.has(p.name)) === true ||
    packagesDev.some((p) => depRequireInstall.has(p.name)) === true
  );
}

export function extractConstraints(
  { config, require, requireDev }: PackageFile,
  { pluginApiVersion }: Lockfile,
): Record<string, string> {
  const res: Record<string, string> = { composer: '1.*' };

  // extract php
  const phpVersion = config?.platform.php;
  if (phpVersion) {
    const major = api.getMajor(phpVersion);
    const minor = coerceNumber(api.getMinor(phpVersion));
    const patch = coerceNumber(api.getPatch(phpVersion));
    res.php = `<=${major}.${minor}.${patch}`;
  } else if (require.php) {
    res.php = require.php;
  }

  // extract direct composer dependency
  if (require['composer/composer']) {
    res.composer = require['composer/composer'];
  } else if (requireDev['composer/composer']) {
    res.composer = requireDev['composer/composer'];
  }
  // composer platform package
  else if (require['composer']) {
    res.composer = require['composer'];
  } else if (requireDev['composer']) {
    res.composer = requireDev['composer'];
  }
  // check last used composer version
  else if (pluginApiVersion) {
    const major = api.getMajor(pluginApiVersion);
    const minor = api.getMinor(pluginApiVersion);
    res.composer = `^${major}.${minor}`;
  }
  // check composer api dependency
  else if (require['composer-runtime-api']) {
    const major = api.getMajor(require['composer-runtime-api']);
    const minor = api.getMinor(require['composer-runtime-api']);
    res.composer = `^${major}.${minor}`;
  }
  return res;
}

export function isArtifactAuthEnabled(rule: HostRuleSearchResult): boolean {
  return !rule.artifactAuth || rule.artifactAuth.includes('composer');
}

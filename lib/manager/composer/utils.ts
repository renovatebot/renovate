import { quote } from 'shlex';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { api, id as composerVersioningId } from '../../versioning/composer';
import type { UpdateArtifactsConfig } from '../types';
import type { ComposerConfig, ComposerLock } from './types';

export { composerVersioningId };

const depRequireInstall = new Set(['symfony/flex']);

export function getComposerArguments(config: UpdateArtifactsConfig): string {
  let args = '';

  if (config.composerIgnorePlatformReqs) {
    if (config.composerIgnorePlatformReqs.length === 0) {
      args += ' --ignore-platform-reqs';
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

export function getPhpConstraint(constraints: Record<string, string>): string {
  const { php } = constraints;

  if (php) {
    logger.debug('Using php constraint from config');
    return php;
  }

  return null;
}

export function requireComposerDependencyInstallation(
  lock: ComposerLock
): boolean {
  return (
    lock.packages?.some((p) => depRequireInstall.has(p.name)) === true ||
    lock['packages-dev']?.some((p) => depRequireInstall.has(p.name)) === true
  );
}

export function extractContraints(
  composerJson: ComposerConfig,
  lockParsed: ComposerLock
): Record<string, string> {
  const res: Record<string, string> = { composer: '1.*' };

  // extract php
  if (composerJson.require?.php) {
    res.php = composerJson.require?.php;
  }

  // extract direct composer dependency
  if (composerJson.require?.['composer/composer']) {
    res.composer = composerJson.require?.['composer/composer'];
  } else if (composerJson['require-dev']?.['composer/composer']) {
    res.composer = composerJson['require-dev']?.['composer/composer'];
  }
  // check last used composer version
  else if (lockParsed?.['plugin-api-version']) {
    const major = api.getMajor(lockParsed?.['plugin-api-version']);
    res.composer = `${major}.*`;
  }
  // check composer api dependency
  else if (composerJson.require?.['composer-runtime-api']) {
    const major = api.getMajor(composerJson.require?.['composer-runtime-api']);
    res.composer = `${major}.*`;
  }
  return res;
}

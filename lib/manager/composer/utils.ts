import { quote } from 'shlex';
import { getGlobalConfig } from '../../config/global';
import { getPkgReleases } from '../../datasource';
import { logger } from '../../logger';
import { api, id as composerVersioningId } from '../../versioning/composer';
import type { UpdateArtifactsConfig } from '../types';
import type { ComposerConfig, ComposerLock } from './types';

export { composerVersioningId };

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
  if (!getGlobalConfig().allowScripts || config.ignoreScripts) {
    args += ' --no-scripts --no-autoloader --no-plugins';
  }

  return args;
}

export async function getComposerConstraint(
  constraints: Record<string, string>
): Promise<string> {
  const { composer } = constraints;

  if (api.isSingleVersion(composer)) {
    logger.debug(
      { version: composer },
      'Using composer constraint from config'
    );
    return composer;
  }

  const release = await getPkgReleases({
    depName: 'composer/composer',
    datasource: 'github-releases',
    versioning: composerVersioningId,
  });

  if (!release?.releases?.length) {
    throw new Error('No composer releases found.');
  }
  let versions = release.releases.map((r) => r.version);

  if (composer) {
    versions = versions.filter(
      (v) => api.isValid(v) && api.matches(v, composer)
    );
  }

  if (!versions.length) {
    throw new Error('No compatible composer releases found.');
  }

  const version = versions.pop();
  logger.debug({ range: composer, version }, 'Using composer constraint');
  return version;
}

export function getPhpConstraint(constraints: Record<string, string>): string {
  const { php } = constraints;

  if (php) {
    logger.debug('Using php constraint from config');
    return php;
  }

  return null;
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

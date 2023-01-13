// TODO: types (#7154)
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { quote } from 'shlex';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import type { ToolConstraint } from '../../../util/exec/types';
import { HostRuleSearch, find as findHostRule } from '../../../util/host-rules';
import { api, id as composerVersioningId } from '../../versioning/composer';
import type { UpdateArtifactsConfig } from '../types';
import type { ComposerConfig, ComposerLock } from './types';

export { composerVersioningId };

const depRequireInstall = new Set(['symfony/flex']);

export function getComposerArguments(
  config: UpdateArtifactsConfig,
  toolConstraint: ToolConstraint
): string {
  let args = '';

  if (config.composerIgnorePlatformReqs) {
    if (config.composerIgnorePlatformReqs.length === 0) {
      // TODO: toolConstraint.constraint can be null or undefined? (#7154)
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
  constraints: Record<string, string>
): string | null {
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

export function extractConstraints(
  composerJson: ComposerConfig,
  lockParsed: ComposerLock
): Record<string, string> {
  const res: Record<string, string> = { composer: '1.*' };

  // extract php
  if (composerJson.config?.platform?.php) {
    const major = api.getMajor(composerJson.config.platform.php);
    const minor = api.getMinor(composerJson.config.platform.php) ?? 0;
    const patch = api.getPatch(composerJson.config.platform.php) ?? 0;
    res.php = `<=${major}.${minor}.${patch}`;
  } else if (composerJson.require?.php) {
    res.php = composerJson.require.php;
  }

  // extract direct composer dependency
  if (composerJson.require?.['composer/composer']) {
    res.composer = composerJson.require?.['composer/composer'];
  } else if (composerJson['require-dev']?.['composer/composer']) {
    res.composer = composerJson['require-dev']?.['composer/composer'];
  }
  // composer platform package
  else if (composerJson.require?.['composer']) {
    res.composer = composerJson.require?.['composer'];
  } else if (composerJson['require-dev']?.['composer']) {
    res.composer = composerJson['require-dev']?.['composer'];
  }
  // check last used composer version
  else if (lockParsed?.['plugin-api-version']) {
    const major = api.getMajor(lockParsed?.['plugin-api-version']);
    const minor = api.getMinor(lockParsed?.['plugin-api-version']);
    res.composer = `^${major}.${minor}`;
  }
  // check composer api dependency
  else if (composerJson.require?.['composer-runtime-api']) {
    const major = api.getMajor(composerJson.require?.['composer-runtime-api']);
    const minor = api.getMinor(composerJson.require?.['composer-runtime-api']);
    res.composer = `^${major}.${minor}`;
  }
  return res;
}

export function findGithubToken(search: HostRuleSearch): string | undefined {
  return findHostRule(search)?.token?.replace('x-access-token:', '');
}

export function isGithubPersonalAccessToken(token: string): boolean {
  return token.startsWith('ghp_');
}

export function isGithubServerToServerToken(token: string): boolean {
  return token.startsWith('ghs_');
}

export function isGithubFineGrainedPersonalAccessToken(token: string): boolean {
  return token.startsWith('github_pat_');
}

export function takePersonalAccessTokenIfPossible(
  githubToken: string | undefined,
  gitTagsGithubToken: string | undefined
): string | undefined {
  if (gitTagsGithubToken && isGithubPersonalAccessToken(gitTagsGithubToken)) {
    logger.debug('Using GitHub Personal Access Token (git-tags)');
    return gitTagsGithubToken;
  }

  if (githubToken && isGithubPersonalAccessToken(githubToken)) {
    logger.debug('Using GitHub Personal Access Token');
    return githubToken;
  }

  if (
    gitTagsGithubToken &&
    isGithubFineGrainedPersonalAccessToken(gitTagsGithubToken)
  ) {
    logger.debug('Using GitHub Fine-grained Personal Access Token (git-tags)');
    return gitTagsGithubToken;
  }

  if (githubToken && isGithubFineGrainedPersonalAccessToken(githubToken)) {
    logger.debug('Using GitHub Fine-grained Personal Access Token');
    return githubToken;
  }

  if (gitTagsGithubToken) {
    if (isGithubServerToServerToken(gitTagsGithubToken)) {
      logger.debug('Using GitHub Server-to-Server token (git-tags)');
    } else {
      logger.debug('Using unknown GitHub token type (git-tags)');
    }
    return gitTagsGithubToken;
  }

  if (githubToken) {
    if (isGithubServerToServerToken(githubToken)) {
      logger.debug('Using GitHub Server-to-Server token');
    } else {
      logger.debug('Using unknown GitHub token type');
    }
  }

  return githubToken;
}

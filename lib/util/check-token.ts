import { GlobalConfig } from '../config/global';
import { logger } from '../logger';
import { GithubReleaseAttachmentsDatasource } from '../modules/datasource/github-release-attachments';
import { GithubReleasesDatasource } from '../modules/datasource/github-releases';
import { GithubTagsDatasource } from '../modules/datasource/github-tags';
import type { PackageFileContent } from '../modules/manager/types';
import type { HostRuleSearchResult } from '../types';
import * as memCache from '../util/cache/memory';
import * as hostRules from './host-rules';

export function checkGithubToken(
  packageFiles: Record<string, PackageFileContent[]> = {},
): void {
  const { token } = hostRules.find({
    hostType: 'github',
    url: 'https://api.github.com',
  });

  if (token) {
    logger.trace('GitHub token is found');
    return;
  }

  if (!GlobalConfig.get('githubTokenWarn')) {
    logger.trace('GitHub token warning is disabled');
    return;
  }

  const githubDeps: string[] = [];
  const deps = Object.values(packageFiles)
    .flat()
    .map((file) => file.deps)
    .flat();
  for (const dep of deps) {
    if (
      !dep.skipReason &&
      (dep.datasource === GithubTagsDatasource.id ||
        dep.datasource === GithubReleasesDatasource.id ||
        dep.datasource === GithubReleaseAttachmentsDatasource.id)
    ) {
      dep.skipReason = 'github-token-required';
      if (dep.depName) {
        githubDeps.push(dep.depName);
      }
    }
  }

  if (githubDeps.length > 0) {
    const warningLogged = memCache.get<boolean | undefined>(
      'github-token-required-warning-logged',
    );
    if (!warningLogged) {
      const withoutDuplicates = [...new Set(githubDeps)];
      logger.warn(
        { githubDeps: withoutDuplicates },
        `GitHub token is required for some dependencies`,
      );
      memCache.set('github-token-required-warning-logged', true);
    }
  }
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

export function findGithubToken(
  searchResult: HostRuleSearchResult,
): string | undefined {
  return searchResult?.token?.replace('x-access-token:', '');
}

export function takePersonalAccessTokenIfPossible(
  githubToken: string | undefined,
  gitTagsGithubToken: string | undefined,
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

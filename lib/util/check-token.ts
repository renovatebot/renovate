import { GlobalConfig } from '../config/global';
import { PlatformId } from '../constants';
import { logger } from '../logger';
import { GithubReleasesDatasource } from '../modules/datasource/github-releases';
import { GithubTagsDatasource } from '../modules/datasource/github-tags';
import type { PackageFile } from '../modules/manager/types';
import * as memCache from '../util/cache/memory';
import * as hostRules from './host-rules';

export function checkGithubToken(
  packageFiles: Record<string, PackageFile[]> | undefined
): void {
  const { token } = hostRules.find({
    hostType: PlatformId.Github,
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
  for (const files of Object.values(packageFiles ?? {})) {
    for (const file of files ?? []) {
      for (const dep of file.deps ?? []) {
        if (
          !dep.skipReason &&
          (dep.datasource === GithubTagsDatasource.id ||
            dep.datasource === GithubReleasesDatasource.id)
        ) {
          dep.skipReason = 'github-token-required';
          if (dep.depName) {
            githubDeps.push(dep.depName);
          }
        }
      }
    }
  }

  if (githubDeps.length > 0) {
    const warningLogged = memCache.get<boolean | undefined>(
      'github-token-required-warning-logged'
    );
    if (!warningLogged) {
      logger.warn(
        { githubDeps },
        `GitHub token is required for some dependencies`
      );
      memCache.set('github-token-required-warning-logged', true);
    }
  }
}

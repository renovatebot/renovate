import { GlobalConfig } from '../config/global';
import { logger } from '../logger';
import { GithubReleaseAttachmentsDatasource } from '../modules/datasource/github-release-attachments';
import { GithubReleasesDatasource } from '../modules/datasource/github-releases';
import { GithubTagsDatasource } from '../modules/datasource/github-tags';
import type { PackageFileContent } from '../modules/manager/types';
import * as memCache from '../util/cache/memory';
import * as hostRules from './host-rules';

export function checkGithubToken(
  packageFiles: Record<string, PackageFileContent[]> = {}
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

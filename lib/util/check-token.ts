import { PlatformId } from '../constants';
import { logger } from '../logger';
import { GithubReleasesDatasource } from '../modules/datasource/github-releases';
import { GithubTagsDatasource } from '../modules/datasource/github-tags';
import type { PackageFile } from '../modules/manager/types';
import * as hostRules from './host-rules';
import { parseUrl } from './url';

function isGithubUrl(url: string | null | undefined): boolean {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return false;
  }

  const { hostname } = parsedUrl;
  return hostname === 'github.com';
}

export function checkGithubToken(
  packageFiles: Record<string, PackageFile[]>
): void {
  const { token } = hostRules.find({
    hostType: PlatformId.Github,
    url: 'https://api.github.com',
  });

  if (token) {
    return;
  }

  const githubDeps: string[] = [];
  for (const files of Object.values(packageFiles)) {
    for (const file of files) {
      for (const dep of file.deps) {
        if (
          dep.datasource === GithubTagsDatasource.id ||
          dep.datasource === GithubReleasesDatasource.id ||
          isGithubUrl(dep.sourceUrl)
        ) {
          // dep.skipReason = 'github-token-required';
          if (dep.depName) {
            githubDeps.push(dep.depName);
          }
        }
      }
    }
  }

  if (githubDeps.length > 0) {
    logger.warn(
      { githubDeps },
      `GitHub token is required for some dependencies`
    );
  }
}

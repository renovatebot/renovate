import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { PackageDependency } from '../types';

export const RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT = regEx(
  /^git@[^:]*:(?<repository>.+)$/
);

export function parseGitOwnerRepo(
  git: string,
  githubUrl: boolean
): string | PackageDependency {
  const genericGitSsh = RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT.exec(git);

  if (genericGitSsh?.groups) {
    return genericGitSsh.groups.repository.replace(regEx(/\.git$/), '');
  } else {
    if (githubUrl) {
      return git
        .replace(regEx(/^github:/), '')
        .replace(regEx(/^git\+/), '')
        .replace(regEx(/^https:\/\/github\.com\//), '')
        .replace(regEx(/\.git$/), '');
    }

    const url = parseUrl(git);

    if (!url) {
      return invalidUrl(git);
    }

    return url.pathname.replace(regEx(/\.git$/), '').replace(regEx(/^\//), '');
  }
}

function invalidUrl(sourceUrl: string): PackageDependency {
  return {
    gitRef: true,
    sourceUrl,
    skipReason: 'invalid-url',
  };
}

export function isGithubUrl(gitUrl: string, parsedUrl: URL | null): boolean {
  return (
    parsedUrl?.host === 'github.com' || gitUrl.startsWith('git@github.com')
  );
}

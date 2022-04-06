import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { PackageDependency } from '../types';

export const RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT =
  regEx(/^(?:git@[^:]*):(.+)$/);

export function parseGitOwnerRepo(
  git: string,
  githubUrl: boolean
): string | PackageDependency {
  const genericGitSsh = RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT.exec(git);

  if (genericGitSsh) {
    return genericGitSsh[1].replace(regEx(/\.git$/), '');
  } else {
    if (githubUrl) {
      return git
        .replace(regEx(/^github:/), '')
        .replace(regEx(/^git\+/), '')
        .replace(regEx(/^https:\/\/github\.com\//), '')
        .replace(regEx(/\.git$/), '');
    }
    try {
      const url = parseUrl(git);

      if (!url) {
        return invalidUrl(git);
      }

      return url.pathname
        .replace(regEx(/\.git$/), '')
        .replace(regEx(/^\//), '');
    } catch (err) {
      return invalidUrl(git);
    }
  }
}

function invalidUrl(git: string): PackageDependency {
  return {
    gitRef: true,
    sourceUrl: git,
    skipReason: 'invalid-url',
  };
}

export function isGithubUrl(git: string, parsedUrl: URL | undefined): boolean {
  return (
    (parsedUrl && parsedUrl.host === 'github.com') ||
    git.startsWith('git@github.com')
  );
}

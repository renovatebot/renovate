import { regEx } from '../../../util/regex';
import type { PackageDependency } from '../types';

export const RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT =
  regEx(/^(?:git@[^:]*):(.+)$/);

export function getGitOwnerRepo(
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
    } else {
      try {
        const url = new URL(git);
        return url.pathname
          .replace(regEx(/\.git$/), '')
          .replace(regEx(/^\//), '');
      } catch (err) {
        return {
          gitRef: true,
          sourceUrl: git,
          skipReason: 'invalid-url',
        };
      }
    }
  }
}

export function isGithubUrl(git: string, parsedUrl: URL | undefined): boolean {
  return (
    (parsedUrl && parsedUrl.host === 'github.com') ||
    git.startsWith('git@github.com')
  );
}

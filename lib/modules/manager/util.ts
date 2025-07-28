import { detectPlatform } from '../../util/common';
import { parseGitUrl } from '../../util/git/url';
import { GitRefsDatasource } from '../datasource/git-refs';
import { GitTagsDatasource } from '../datasource/git-tags';
import { GithubTagsDatasource } from '../datasource/github-tags';
import { GitlabTagsDatasource } from '../datasource/gitlab-tags';
import type { PackageDependency } from './types';

export function applyGitSource(
  dep: PackageDependency,
  git: string,
  rev: string | undefined,
  tag: string | undefined,
  branch: string | undefined,
): void {
  if (tag) {
    // Try to parse the git URL first to extract source information
    const parsedGitUrl = parseGitUrl(git);
    const platform =
      parsedGitUrl.source === 'github.com'
        ? 'github'
        : parsedGitUrl.source === 'gitlab.com'
          ? 'gitlab'
          : detectPlatform(git);

    if (platform === 'github' || platform === 'gitlab') {
      dep.datasource =
        platform === 'github'
          ? GithubTagsDatasource.id
          : GitlabTagsDatasource.id;
      // Always use HTTPS for GitHub/GitLab API endpoints, regardless of git URL protocol
      dep.registryUrls = [`https://${parsedGitUrl.source}`];
      dep.packageName = parsedGitUrl.full_name;
    } else {
      dep.datasource = GitTagsDatasource.id;
      dep.packageName = git;
    }
    dep.currentValue = tag;
    dep.skipReason = undefined;
  } else if (rev) {
    dep.datasource = GitRefsDatasource.id;
    dep.packageName = git;
    dep.currentDigest = rev;
    dep.replaceString = rev;
    dep.skipReason = undefined;
  } else {
    dep.datasource = GitRefsDatasource.id;
    dep.packageName = git;
    dep.currentValue = branch;
    dep.skipReason = branch ? 'git-dependency' : 'unspecified-version';
  }
}

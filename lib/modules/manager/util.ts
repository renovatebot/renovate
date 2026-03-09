import { detectPlatform } from '../../util/common.ts';
import { parseGitUrl } from '../../util/git/url.ts';
import { GitRefsDatasource } from '../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../datasource/gitlab-tags/index.ts';
import type { PackageDependency } from './types.ts';

export function applyGitSource(
  dep: PackageDependency,
  git: string,
  rev: string | undefined,
  tag: string | undefined,
  branch: string | undefined,
): void {
  if (tag) {
    const platform = detectPlatform(git);
    if (platform === 'github' || platform === 'gitlab') {
      dep.datasource =
        platform === 'github'
          ? GithubTagsDatasource.id
          : GitlabTagsDatasource.id;
      const { host, full_name } = parseGitUrl(git);

      // Always use HTTPS for GitHub/GitLab API endpoints, even if the git URL protocol is SSH.
      dep.registryUrls = [`https://${host}`];
      dep.packageName = full_name;
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

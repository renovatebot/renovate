import type { GitHostFamilyId } from '../../constants/index.ts';
import { GIT_HOST_FAMILIES } from '../../constants/index.ts';
import { detectPlatform } from '../../util/common.ts';
import type { ExecError } from '../../util/exec/exec-error.ts';
import { parseGitUrl } from '../../util/git/url.ts';
import { GitRefsDatasource } from '../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../datasource/git-tags/index.ts';
import type { GitHostTagsSource, PackageDependency } from './types.ts';

/**
 * Resolve which host-family tags datasource covers a git URL.
 *
 * Managers pass the families they support; any other host returns `null` so the
 * caller can fall back to its own default, usually the generic `git-tags`
 * datasource.
 */
export function gitHostTagsSource(
  url: string,
  families: readonly GitHostFamilyId[],
): GitHostTagsSource | null {
  const family = detectPlatform(url);
  if (!family || !families.includes(family)) {
    return null;
  }
  return { family, datasource: GIT_HOST_FAMILIES[family].tagsDatasource };
}

/**
 * Whether `host` is one of the vendor-run instances of `family`, which its
 * datasource already uses by default so the dependency needs no `registryUrls`.
 */
export function isPublicGitHost(
  family: GitHostFamilyId,
  host: string,
): boolean {
  return GIT_HOST_FAMILIES[family].publicHosts.includes(host);
}

export function applyGitSource(
  dep: PackageDependency,
  git: string,
  rev: string | undefined,
  tag: string | undefined,
  branch: string | undefined,
): void {
  if (tag) {
    const tagsSource = gitHostTagsSource(git, ['github', 'gitlab']);
    if (tagsSource) {
      dep.datasource = tagsSource.datasource;
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

/**
 * Given an {@link ExecError}, retrieve the message which will be used for an {@link ArtifactError}.
 *
 * An `ExecError` always carries a `stderr` property, so nullish coalescing would keep an empty string and render an artifact error with no message at all.
 *
 */
export function artifactErrorMessageFromExecError(
  err: Partial<ExecError>,
  message: string,
): string {
  if (err.stderr?.trim()) {
    return err.stderr;
  }

  if (err.stdout?.trim()) {
    return err.stdout;
  }

  return message;
}

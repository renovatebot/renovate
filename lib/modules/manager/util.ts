import { detectPlatform } from '../../util/common.ts';
import type { ExecError } from '../../util/exec/exec-error.ts';
import { parseGitUrl } from '../../util/git/url.ts';
import { parseUrl } from '../../util/url.ts';
import { BitbucketTagsDatasource } from '../datasource/bitbucket-tags/index.ts';
import { GitRefsDatasource } from '../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../datasource/git-tags/index.ts';
import { GiteaTagsDatasource } from '../datasource/gitea-tags/index.ts';
import { GithubTagsDatasource } from '../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../datasource/gitlab-tags/index.ts';
import type {
  GitTagsPlatform,
  GitTagsSource,
  PackageDependency,
  ResolveGitTagsSourceConfig,
} from './types.ts';

/**
 * The tags datasource of each host family, next to the host its
 * `defaultRegistryUrls` already point at.
 */
const gitTagsSources = {
  bitbucket: {
    datasource: BitbucketTagsDatasource.id,
    defaultHost: 'bitbucket.org',
  },
  gitea: { datasource: GiteaTagsDatasource.id, defaultHost: 'gitea.com' },
  github: { datasource: GithubTagsDatasource.id, defaultHost: 'github.com' },
  gitlab: { datasource: GitlabTagsDatasource.id, defaultHost: 'gitlab.com' },
} satisfies Record<
  GitTagsPlatform,
  { datasource: string; defaultHost: string }
>;

function isGitTagsPlatform(
  platform: string | null,
): platform is GitTagsPlatform {
  return !!platform && platform in gitTagsSources;
}

function tryParseGitUrl(url: string): ReturnType<typeof parseGitUrl> | null {
  try {
    return parseGitUrl(url);
  } catch {
    return null;
  }
}

/**
 * Resolve how to look up a dependency which is pinned to a tag in a git
 * repository.
 *
 * Repositories on a host family with a tags datasource are looked up through
 * its API, which needs the `owner/repo` path as `packageName` and the host as
 * `registryUrls`; every other repository is cloned by the `git-tags`
 * datasource, which takes the URL as given. SCP-style URLs
 * (`git@host:owner/repo.git`) resolve like their `ssh://` equivalent.
 */
export function resolveGitTagsSource(
  gitUrl: string,
  config: ResolveGitTagsSourceConfig = {},
): GitTagsSource {
  const { platforms = ['github', 'gitlab'], keepDefaultRegistryUrl = false } =
    config;
  const gitTags: GitTagsSource = {
    datasource: GitTagsDatasource.id,
    packageName: gitUrl,
  };

  const parsed = tryParseGitUrl(gitUrl);
  if (!parsed) {
    return gitTags;
  }
  const { full_name, host, resource, protocol } = parsed;

  // `detectPlatform` needs a URL, which an SCP-style git URL is not, so hand it
  // the host we parsed out of one instead.
  const platform = detectPlatform(
    parseUrl(gitUrl) ? gitUrl : `https://${host}`,
  );
  if (!isGitTagsPlatform(platform) || !platforms.includes(platform)) {
    return gitTags;
  }

  // Always use HTTPS for the API endpoint, even if the git URL protocol is SSH.
  // A port on a URL which does not already speak HTTP belongs to the git
  // transport rather than to the API.
  const registryHost =
    protocol === 'https' || protocol === 'http' ? host : resource;
  const { datasource, defaultHost } = gitTagsSources[platform];

  return {
    datasource,
    packageName: full_name,
    ...((keepDefaultRegistryUrl || registryHost !== defaultHost) && {
      registryUrls: [`https://${registryHost}`],
    }),
  };
}

export function applyGitSource(
  dep: PackageDependency,
  git: string,
  rev: string | undefined,
  tag: string | undefined,
  branch: string | undefined,
): void {
  if (tag) {
    Object.assign(
      dep,
      resolveGitTagsSource(git, { keepDefaultRegistryUrl: true }),
    );
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

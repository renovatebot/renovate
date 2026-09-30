import { regEx } from '../../../util/regex.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';

// e.g. git::https://github.com/org/cfg.git//base/mise.toml?ref=v1.2.0
// e.g. git::ssh://git@github.com/org/cfg.git//mise.toml
const gitIncludeRegex = regEx(
  /^git::(?<url>(?:https|ssh):\/\/(?:[^@/]+@)?(?<host>[^/:]+)(?::\d+)?\/(?<repo>.+?\.git))(?:\/\/(?<path>[^?]*))?(?:\?(?<query>.*))?$/,
);
const refRegex = regEx(/(?:^|&)ref=(?<ref>[^&]+)/);
const refValueRegex = regEx(/(?<prefix>[?&]ref=)[^&]+/);
const ociPrefix = 'oci::';

function extractGitInclude(
  include: string,
  groups: Record<string, string | undefined>,
): PackageDependency {
  const { url, host, repo, query } = groups;
  const repoName = repo!.replace(regEx(/\.git$/), '');
  const dep: PackageDependency = {
    depName: `${host!}/${repoName}`,
    depType: 'include',
    packageName: url,
  };

  if (host === 'github.com') {
    dep.datasource = GithubTagsDatasource.id;
    dep.packageName = repoName;
  } else if (host === 'bitbucket.org') {
    dep.datasource = BitbucketTagsDatasource.id;
    dep.packageName = repoName;
  } else {
    dep.datasource = GitTagsDatasource.id;
  }

  const ref = refRegex.exec(query ?? '')?.groups?.ref;
  if (!ref) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }
  dep.currentValue = ref;
  // Match the whole entry, but only replace the `ref` value.
  dep.replaceString = include;
  dep.autoReplaceStringTemplate = include.replace(
    refValueRegex,
    '$<prefix>{{newValue}}',
  );
  return dep;
}

function extractOciInclude(include: string): PackageDependency {
  // `replaceString` and the template cover the image reference only,
  // so the `oci::` prefix stays in place.
  const dep = getDep(include.slice(ociPrefix.length));
  return { ...dep, depType: 'include' };
}

/**
 * Extracts a remote `include` entry of a mise configuration file.
 * @link https://mise.jdx.dev/configuration.html#include
 */
export function extractInclude(include: string): PackageDependency {
  const trimmed = include.trim();
  if (trimmed.startsWith(ociPrefix)) {
    return extractOciInclude(trimmed);
  }
  const gitMatch = gitIncludeRegex.exec(trimmed);
  if (gitMatch?.groups) {
    return extractGitInclude(trimmed, gitMatch.groups);
  }
  return {
    depName: trimmed,
    depType: 'include',
    skipReason: 'unsupported-url',
  };
}

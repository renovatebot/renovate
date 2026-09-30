import { regEx } from '../../../util/regex.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubDigestDatasource } from '../../datasource/github-digest/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import * as exactVersioning from '../../versioning/exact/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import {
  isSha,
  isShortSha,
  parseComment,
  versionLikeRe,
} from '../github-actions/parse.ts';
import type { PackageDependency } from '../types.ts';

// e.g. git::https://github.com/org/cfg.git//base/mise.toml?ref=v1.2.0
// e.g. git::ssh://git@github.com/org/cfg.git//mise.toml
const gitIncludeRegex = regEx(
  /^git::(?<url>(?:https|ssh):\/\/(?:[^@/]+@)?(?<host>[^/:]+)(?::\d+)?\/(?<repo>.+?\.git))(?:\/\/(?<path>[^?]*))?(?:\?(?<query>.*))?$/,
);
const refRegex = regEx(/(?:^|&)ref=(?<ref>[^&]+)/);
const refValueRegex = regEx(/(?<prefix>[?&]ref=)[^&]+/);
const ociPrefix = 'oci::';
// the rest of the line after an include string, e.g. `", # v1.0.0`
const trailingCommentRegex = regEx(
  /^(?<separator>["']\s*,?[ \t]*)#(?<comment>.*)$/,
);

interface IncludeComment {
  /** text between the include string and the comment, e.g. `", ` */
  separator: string;
  /** everything after the include string up to the end of the hint token */
  replaceSuffix: string;
  /** the hint: a version (`v1.2.3`) or a branch (`main`) */
  value: string;
}

/**
 * Finds the trailing `#` comment of an array entry in the raw file.
 * Only entries of multi-line arrays can carry a comment.
 */
function findComment(
  include: string,
  content: string,
): IncludeComment | undefined {
  let index = content.indexOf(include);
  while (index !== -1) {
    const end = index + include.length;
    const lineEnd = content.indexOf('\n', end);
    const rest = content.slice(end, lineEnd === -1 ? undefined : lineEnd);
    const groups = trailingCommentRegex.exec(rest.trimEnd())?.groups;
    if (groups) {
      const data = parseComment(groups.comment);
      const value = data.pinnedVersion ?? data.ref;
      if (value && data.index !== undefined && data.matchedString) {
        const tokenEnd = data.index + data.matchedString.length;
        return {
          separator: groups.separator,
          replaceSuffix: `${groups.separator}#${groups.comment.slice(0, tokenEnd)}`,
          value,
        };
      }
    }
    index = content.indexOf(include, end);
  }
  return undefined;
}

/**
 * Handles `ref=<sha>`: the version or branch comes from the trailing comment.
 */
function applyPinnedRef(
  dep: PackageDependency,
  include: string,
  url: string,
  ref: string,
  content: string,
): void {
  if (isSha(ref)) {
    dep.currentDigest = ref;
  } else {
    dep.currentDigestShort = ref;
  }
  const comment = findComment(include, content);
  if (!comment) {
    dep.skipReason = 'unversioned-reference';
    return;
  }
  dep.currentValue = comment.value;
  // Also match the comment, so that it is updated together with the sha.
  dep.replaceString = `${include}${comment.replaceSuffix}`;
  dep.autoReplaceStringTemplate = `${include.replace(
    refValueRegex,
    '$<prefix>{{#if newDigest}}{{newDigest}}{{else}}{{newValue}}{{/if}}',
  )}${comment.separator}# {{newValue}}`;
  if (!versionLikeRe.test(comment.value)) {
    // branch hint: only the digest changes
    dep.versioning = exactVersioning.id;
    if (dep.datasource === GithubTagsDatasource.id) {
      dep.datasource = GithubDigestDatasource.id;
    } else {
      dep.datasource = GitRefsDatasource.id;
      dep.packageName = url;
    }
  }
}

function extractGitInclude(
  include: string,
  content: string,
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
  if (isSha(ref) || isShortSha(ref)) {
    applyPinnedRef(dep, include, url!, ref, content);
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
 * `content` is the raw file, used to read trailing comment hints.
 * @link https://mise.jdx.dev/configuration.html#include
 */
export function extractInclude(
  include: string,
  content: string,
): PackageDependency {
  const trimmed = include.trim();
  if (trimmed.startsWith(ociPrefix)) {
    return extractOciInclude(trimmed);
  }
  const gitMatch = gitIncludeRegex.exec(trimmed);
  if (gitMatch?.groups) {
    return extractGitInclude(trimmed, content, gitMatch.groups);
  }
  return {
    depName: trimmed,
    depType: 'include',
    skipReason: 'unsupported-url',
  };
}

import { parseGitUrl } from '../../../util/git/url.ts';
import { regEx } from '../../../util/regex.ts';
import { trimSlashes } from '../../../util/url.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubDigestDatasource } from '../../datasource/github-digest/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import * as exactVersioning from '../../versioning/exact/index.ts';
import { isSha, isShortSha, versionLikeRe } from '../github-actions/parse.ts';
import type { PackageDependency } from '../types.ts';

const gitPrefix = 'git::';
const protocolRegex = regEx(/^(?:https?|ssh):\/\/[^/]+/);
// scp-like urls are only supported by mise for Azure DevOps, which git-url-parse can not parse
const azureDevOpsSshRegex = regEx(
  /^(?<url>git@(?<host>ssh\.dev\.azure\.com):v3\/(?<repoName>[^/]+\/[^/]+\/[^/]+))\/\/[^?]+(?:\?(?<query>.*))?$/,
);
const refValueRegex = regEx(/(?<prefix>[?&]ref=)[^&]+/);
// the rest of the line after a reference string, e.g. `", # v1.0.0`
// `=` is excluded so that `# tag=v1.0.0` style comments are not read as a branch
const trailingCommentRegex = regEx(
  /^(?<separator>["']\s*,?[ \t]*)#[ \t]*(?<value>[^\s#=]+)$/,
);

interface ReferenceComment {
  /** text between the reference string and the comment, e.g. `", ` */
  separator: string;
  /** everything after the reference string, including the comment */
  replaceSuffix: string;
  /** the hint: a version (`v1.2.3`) or a branch (`main`) */
  value: string;
}

/**
 * Finds the trailing `# <version>` or `# <branch>` comment of an entry in the raw file.
 * Only entries of multi-line arrays can carry a comment.
 */
function findComment(
  reference: string,
  content: string,
): ReferenceComment | undefined {
  let index = content.indexOf(reference);
  while (index !== -1) {
    const end = index + reference.length;
    const lineEnd = content.indexOf('\n', end);
    const rest = content.slice(end, lineEnd === -1 ? undefined : lineEnd);
    const suffix = rest.trimEnd();
    const groups = trailingCommentRegex.exec(suffix)?.groups;
    if (groups) {
      return {
        separator: groups.separator,
        replaceSuffix: suffix,
        value: groups.value,
      };
    }
    index = content.indexOf(reference, end);
  }
  return undefined;
}

/**
 * Handles `ref=<sha>`: the version or branch comes from the trailing comment.
 */
function applyPinnedRef(
  dep: PackageDependency,
  reference: string,
  url: string,
  ref: string,
  content: string,
): void {
  if (isSha(ref)) {
    dep.currentDigest = ref;
  } else {
    dep.currentDigestShort = ref;
  }
  const comment = findComment(reference, content);
  if (!comment) {
    dep.skipReason = 'unversioned-reference';
    return;
  }
  dep.currentValue = comment.value;
  // Also match the comment, so that it is updated together with the sha.
  dep.replaceString = `${reference}${comment.replaceSuffix}`;
  dep.autoReplaceStringTemplate = `${reference.replace(
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

interface GitReference {
  /** repository url without the file path and query, e.g. `https://github.com/org/cfg.git` */
  url: string;
  host: string;
  /** e.g. `org/cfg` */
  repoName: string;
  ref: string | undefined;
}

/**
 * Parses e.g. `https://github.com/org/cfg.git//base/mise.toml?ref=v1.2.0`
 * or `ssh://git@github.com/org/cfg.git//mise.toml`.
 */
function parseGitReference(reference: string): GitReference | null {
  const azure = azureDevOpsSshRegex.exec(reference)?.groups;
  if (azure) {
    return {
      url: azure.url,
      host: azure.host,
      repoName: azure.repoName,
      ref: new URLSearchParams(azure.query).get('ref') ?? undefined,
    };
  }
  const origin = protocolRegex.exec(reference)?.[0];
  if (!origin) {
    return null;
  }
  const parsed = parseGitUrl(reference);
  // `//` separates the repository from the file path, which git-url-parse does not handle
  const [repoPath] = parsed.pathname.split('//');
  const repoName = trimSlashes(repoPath).replace(regEx(/\.git$/), '');
  if (!repoName) {
    return null;
  }
  return {
    url: `${origin}${repoPath}`,
    host: parsed.resource,
    repoName,
    ref: parsed.query.ref,
  };
}

/**
 * Extracts a `git::<protocol>://<host>/<repo>.git//<path>?ref=<ref>` reference.
 * Returns `null` if `reference` is not a git reference.
 * `content` is the raw file, used to read trailing comment hints.
 * @link https://mise.jdx.dev/tasks/toml-tasks.html#git
 */
export function extractGitReference(
  reference: string,
  content: string,
  depType: string,
): PackageDependency | null {
  if (!reference.startsWith(gitPrefix)) {
    return null;
  }
  const parsed = parseGitReference(reference.slice(gitPrefix.length));
  if (!parsed) {
    return null;
  }
  const { url, host, repoName, ref } = parsed;
  const dep: PackageDependency = {
    depName: `${host}/${repoName}`,
    depType,
    packageName: url,
  };

  if (host === 'github.com') {
    dep.datasource = GithubTagsDatasource.id;
    dep.packageName = repoName;
  } else if (host === 'bitbucket.org') {
    dep.datasource = BitbucketTagsDatasource.id;
    dep.packageName = repoName;
  } else if (host === 'gitlab.com') {
    dep.datasource = GitlabTagsDatasource.id;
    dep.packageName = repoName;
  } else {
    dep.datasource = GitTagsDatasource.id;
  }

  if (!ref) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }
  if (isSha(ref) || isShortSha(ref)) {
    applyPinnedRef(dep, reference, url, ref, content);
    return dep;
  }
  dep.currentValue = ref;
  // Match the whole entry, but only replace the `ref` value.
  dep.replaceString = reference;
  dep.autoReplaceStringTemplate = reference.replace(
    refValueRegex,
    '$<prefix>{{newValue}}',
  );
  return dep;
}

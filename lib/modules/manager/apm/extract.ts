import { isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { detectPlatform } from '../../../util/common.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { isLongCommitSha } from '../../../util/schema-utils/git.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { ApmManifest } from './schema.ts';

interface DatasourceResult {
  datasource: string;
  packageName: string;
  registryUrls?: string[];
}

/**
 * Determine which Renovate datasource to use for an APM dependency, based on
 * the git host `platform` (already resolved via `detectPlatform`, which honors
 * `hostRules`). github/gitlab (and their self-hosted variants) map to the
 * `github-tags` / `gitlab-tags` datasources; every other host (Bitbucket, Azure
 * DevOps, etc.) falls back to the generic `git-tags` datasource.
 */
function determineDatasource(
  host: string,
  platform: string | null,
  repoPath: string,
): DatasourceResult {
  if (platform === 'github') {
    return {
      datasource: GithubTagsDatasource.id,
      packageName: repoPath,
      ...(host === 'github.com' ? {} : { registryUrls: [`https://${host}`] }),
    };
  }

  if (platform === 'gitlab') {
    return {
      datasource: GitlabTagsDatasource.id,
      packageName: repoPath,
      ...(host === 'gitlab.com' ? {} : { registryUrls: [`https://${host}`] }),
    };
  }

  return {
    datasource: GitTagsDatasource.id,
    packageName: `https://${host}/${repoPath}`,
  };
}

/** A trailing ` # <tag>` comment on a manifest line. */
const commentTagRegex = regEx(/^\s+#\s*(?<tag>\S.*?)\s*$/);

/**
 * Renders both `owner/repo#<tag>` and the digest-pinned
 * `owner/repo#<sha> # <tag>` form, mirroring the github-actions
 * `uses: owner/action@<sha> # v4` behaviour so `pinDigests` can pin a bare tag
 * to a SHA and keep the trailing tag comment current.
 */
const autoReplaceStringTemplate =
  '{{depName}}#{{#if newDigest}}{{newDigest}} # {{newValue}}{{else}}{{newValue}}{{/if}}';

/**
 * APM virtual-package subpaths (skills/prompts/etc.) begin at one of these
 * "primitive" directories or at a file with a virtual extension. APM only uses
 * these to find where a repo path ends for hosts with nested namespaces; see
 * `_GITLAB_VIRTUAL_ROOT_SEGMENTS` / `VIRTUAL_FILE_EXTENSIONS` in apm.
 */
const virtualRootSegments = new Set(['prompts', 'instructions', 'collections']);
const virtualFileRegex = regEx(/\.(?:prompt|instructions|chatmode|agent)\.md$/);

/**
 * Resolve the repository path from the host-stripped path segments.
 *
 * GitHub repos are always `owner/repo`. GitLab (and other hosts) allow nested
 * groups, so the project slug can span 3+ segments; the virtual-package subpath,
 * if any, begins at a primitive directory or virtual file (index >= 2). Returns
 * `null` when there is no `owner/repo` (fewer than two segments).
 */
function resolveRepoPath(
  platform: string | null,
  segments: string[],
): string | null {
  if (segments.length < 2) {
    return null;
  }
  if (platform === 'github') {
    return segments.slice(0, 2).join('/');
  }
  let boundary = segments.length;
  for (let i = 2; i < segments.length; i++) {
    if (
      virtualRootSegments.has(segments[i]) ||
      virtualFileRegex.test(segments[i])
    ) {
      boundary = i;
      break;
    }
  }
  return segments.slice(0, boundary).join('/');
}

interface PinnedTail {
  replaceString: string;
  currentValue: string;
}

/**
 * APM keeps the release tag for a SHA-pinned dependency in a trailing YAML
 * comment (`owner/repo#<sha> # v2.0.0`), which the structured parse strips.
 *
 * Returns a matcher that scans the raw manifest for the (unquoted) entry to
 * recover the tag as `currentValue` and the exact text to replace, so
 * `pinDigests` can update both the SHA and the tag. Each line is consumed at
 * most once (in file order), so the same `owner/repo#<sha>` pinned in more than
 * one section maps to distinct lines rather than all resolving to the first
 * match. Yields `undefined` for a bare SHA (no tag comment) or a form we can't
 * recover verbatim (e.g. quoted), which the caller then skips.
 */
function createPinnedTailFinder(
  content: string,
): (value: string) => PinnedTail | undefined {
  const lines = content.split(newlineRegex);
  const consumed = new Set<number>();
  return (value) => {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) {
        continue;
      }
      const item = lines[i].trimStart();
      if (!item.startsWith('-')) {
        continue;
      }
      const afterDash = item.slice(1).trimStart();
      if (!afterDash.startsWith(value)) {
        continue;
      }
      consumed.add(i);
      const tail = commentTagRegex.exec(afterDash.slice(value.length));
      if (!tail?.groups?.tag) {
        return undefined;
      }
      return {
        replaceString: afterDash.trimEnd(),
        currentValue: tail.groups.tag,
      };
    }
    return undefined;
  };
}

/**
 * Parse a single APM dependency string of the form
 * `[host/]owner/repo[/subpath...][#<ref>]`, where `<ref>` is a semver tag/range,
 * a branch, or a commit SHA.
 *
 * For a SHA-pinned entry the release tag lives in a trailing YAML comment; when
 * present it is recovered from `content` so the entry updates as a digest
 * (`currentDigest` + `currentValue`). A bare SHA with no tag comment has no
 * version to track and is skipped.
 */
export function parseApmDependency(
  entry: string,
  depType: string,
  findPinnedTail: (value: string) => PinnedTail | undefined,
): PackageDependency {
  const hashIndex = entry.indexOf('#');
  const pathPart = hashIndex === -1 ? entry : entry.slice(0, hashIndex);
  const ref = hashIndex === -1 ? '' : entry.slice(hashIndex + 1).trim();

  const base: PackageDependency = {
    depName: pathPart,
    depType,
  };

  if (!ref) {
    // Unpinned dependency (no `#ref`) - nothing for Renovate to update.
    return { ...base, skipReason: 'unspecified-version' };
  }

  // The optional host prefix is a hostname (so it contains a dot); git host
  // owner names never do, which disambiguates the leading segment.
  const segments = pathPart.split('/').filter(isTruthy);
  const hasHost = (segments[0] ?? '').includes('.');
  const host = hasHost ? segments[0] : 'github.com';
  const platform = detectPlatform(`https://${host}`);
  const repoPath = resolveRepoPath(
    platform,
    hasHost ? segments.slice(1) : segments,
  );

  if (!repoPath) {
    logger.debug({ entry }, 'apm: could not determine owner/repo');
    return {
      ...base,
      currentValue: ref,
      skipReason: 'invalid-dependency-specification',
    };
  }

  const { datasource, packageName, registryUrls } = determineDatasource(
    host,
    platform,
    repoPath,
  );
  const dep: PackageDependency = {
    ...base,
    datasource,
    packageName,
    ...(registryUrls ? { registryUrls } : {}),
    autoReplaceStringTemplate,
  };

  if (isLongCommitSha(ref)) {
    const tail = findPinnedTail(entry);
    if (!tail) {
      // Bare SHA with no recoverable tag comment - no version to track.
      return {
        ...base,
        currentDigest: ref,
        skipReason: 'unversioned-reference',
      };
    }
    return {
      ...dep,
      currentValue: tail.currentValue,
      currentDigest: ref,
      replaceString: tail.replaceString,
    };
  }

  return {
    ...dep,
    currentValue: ref,
    replaceString: entry,
  };
}

function extractSection(
  entries: string[] | undefined,
  depType: string,
  findPinnedTail: (value: string) => PinnedTail | undefined,
): PackageDependency[] {
  return coerceArray(entries).map((entry) =>
    parseApmDependency(entry, depType, findPinnedTail),
  );
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let manifest: ApmManifest;
  try {
    manifest = parseSingleYaml(content, { customSchema: ApmManifest });
  } catch (err) {
    logger.debug({ packageFile, err }, 'apm: failed to parse manifest');
    return null;
  }

  const findPinnedTail = createPinnedTailFinder(content);
  const deps = [
    ...extractSection(manifest.dependencies?.apm, 'apm', findPinnedTail),
    ...extractSection(manifest.devDependencies?.apm, 'apm-dev', findPinnedTail),
  ];

  if (!deps.length) {
    return null;
  }

  return { deps };
}

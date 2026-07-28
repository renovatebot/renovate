import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { detectPlatform } from '../../../util/common.ts';
import { regEx } from '../../../util/regex.ts';
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

/** A full commit SHA (git sha1 or sha256). */
const shaRegex = regEx(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i);

/**
 * APM virtual-package subpaths (skills/prompts/etc.) begin at one of these
 * "primitive" directories or at a file with a virtual extension. APM only uses
 * these to find where a repo path ends for hosts with nested namespaces; see
 * `_GITLAB_VIRTUAL_ROOT_SEGMENTS` / `VIRTUAL_FILE_EXTENSIONS` in apm.
 */
const virtualRootSegments = new Set(['prompts', 'instructions', 'collections']);
const virtualFileRegex = regEx(/\.(?:prompt|instructions|agent)\.md$/);

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

/**
 * Parse a single APM dependency string of the form
 * `[host/]owner/repo[/subpath...][#<ref>]`, where `<ref>` is a semver tag/range,
 * a branch, or a commit SHA.
 *
 * APM documents pinning to a commit SHA with the release tag kept as a trailing
 * YAML comment (`owner/repo#<sha> # v2.0.0`). YAML parsing strips that comment,
 * so the tag isn't visible here; such entries are skipped rather than treating
 * the SHA as a version (which no `*-tags` datasource can resolve) or rewriting
 * it. Keeping SHA-pinned entries current would need `pinDigests`/digest support
 * built on a comment-preserving parse - a larger, separate change.
 */
export function parseApmDependency(
  entry: string,
  depType: string,
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
  const segments = pathPart.split('/').filter(Boolean);
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

  if (shaRegex.test(ref)) {
    // SHA-pinned entry - recognized and left intact (see note above).
    return { ...base, currentDigest: ref, skipReason: 'unversioned-reference' };
  }

  const { datasource, packageName, registryUrls } = determineDatasource(
    host,
    platform,
    repoPath,
  );

  return {
    ...base,
    currentValue: ref,
    datasource,
    packageName,
    ...(registryUrls ? { registryUrls } : {}),
    replaceString: entry,
    autoReplaceStringTemplate: '{{depName}}#{{newValue}}',
  };
}

function extractSection(
  entries: string[] | undefined,
  depType: string,
): PackageDependency[] {
  return coerceArray(entries).map((entry) =>
    parseApmDependency(entry, depType),
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

  const deps = [
    ...extractSection(manifest.dependencies?.apm, 'apm'),
    ...extractSection(manifest.devDependencies?.apm, 'apm-dev'),
  ];

  if (!deps.length) {
    return null;
  }

  return { deps };
}

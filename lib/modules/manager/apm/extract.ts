import { isPlainObject, isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import type { SkipReason } from '../../../types/index.ts';
import { detectPlatform } from '../../../util/common.ts';
import { regEx } from '../../../util/regex.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type { ApmDependencies, ApmManifest } from './types.ts';

interface DatasourceResult {
  datasource: string;
  packageName: string;
  registryUrls?: string[];
}

/**
 * Determine which Renovate datasource to use for an APM dependency, based on
 * the git host. Reuses `detectPlatform` (which also honors `hostRules`) to map
 * github.com/gitlab.com and their self-hosted variants to the `github-tags` and
 * `gitlab-tags` datasources, and falls back to the generic `git-tags`
 * datasource for every other host (Bitbucket, Azure DevOps, etc.).
 */
function determineDatasource(host: string, repoPath: string): DatasourceResult {
  const repoUrl = `https://${host}/${repoPath}`;
  const platform = detectPlatform(repoUrl);

  if (host === 'github.com' || platform === 'github') {
    logger.debug({ repoUrl }, 'apm: found github dependency');
    return {
      datasource: GithubTagsDatasource.id,
      packageName: repoPath,
      ...(host === 'github.com' ? {} : { registryUrls: [`https://${host}`] }),
    };
  }

  if (host === 'gitlab.com' || platform === 'gitlab') {
    logger.debug({ repoUrl }, 'apm: found gitlab dependency');
    return {
      datasource: GitlabTagsDatasource.id,
      packageName: repoPath,
      ...(host === 'gitlab.com' ? {} : { registryUrls: [`https://${host}`] }),
    };
  }

  logger.debug({ repoUrl }, 'apm: using git-tags datasource');
  return { datasource: GitTagsDatasource.id, packageName: repoUrl };
}

const hostnameRegex = regEx(/\./);

/**
 * Parse a single APM dependency string of the form
 * `[host/]owner/repo[/subpath...][#ref]`.
 */
export function parseApmDependency(
  entry: string,
  depType: string,
): PackageDependency {
  const hashIndex = entry.indexOf('#');
  const pathPart = hashIndex === -1 ? entry : entry.slice(0, hashIndex);
  const currentValue = hashIndex === -1 ? '' : entry.slice(hashIndex + 1);

  const base: PackageDependency = {
    depName: pathPart,
    depType,
  };

  if (!currentValue) {
    // Unpinned dependency (no `#ref`) - nothing for Renovate to update.
    return { ...base, skipReason: 'unspecified-version' as SkipReason };
  }

  const segments = pathPart.split('/').filter(Boolean);
  const hasHost = hostnameRegex.test(segments[0] ?? '');
  const host = hasHost ? segments[0] : 'github.com';
  const repoSegments = hasHost ? segments.slice(1) : segments;

  if (repoSegments.length < 2) {
    logger.debug({ entry }, 'apm: could not determine owner/repo');
    return {
      ...base,
      currentValue,
      skipReason: 'invalid-dependency-specification' as SkipReason,
    };
  }

  const repoPath = repoSegments.slice(0, 2).join('/');
  const { datasource, packageName, registryUrls } = determineDatasource(
    host,
    repoPath,
  );

  return {
    ...base,
    currentValue,
    datasource,
    packageName,
    ...(registryUrls ? { registryUrls } : {}),
    replaceString: entry,
    autoReplaceStringTemplate: '{{depName}}#{{newValue}}',
  };
}

function extractSection(
  deps: ApmDependencies | undefined,
  depType: string,
): PackageDependency[] {
  const result: PackageDependency[] = [];
  if (!deps || !Array.isArray(deps.apm)) {
    return result;
  }
  for (const entry of deps.apm) {
    // MCP entries are objects without a version and are not managed - skip.
    if (!isString(entry)) {
      continue;
    }
    result.push(parseApmDependency(entry, depType));
  }
  return result;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let parsed: unknown;
  try {
    parsed = parseSingleYaml(content);
  } catch (err) {
    logger.debug({ packageFile, err }, 'apm: failed to parse YAML');
    return null;
  }

  if (!isPlainObject(parsed)) {
    logger.debug({ packageFile }, 'apm: parsed content is not an object');
    return null;
  }

  const manifest = parsed as ApmManifest;
  const deps = [
    ...extractSection(manifest.dependencies, 'apm'),
    ...extractSection(manifest.devDependencies, 'apm-dev'),
  ];

  if (!deps.length) {
    return null;
  }

  return { deps };
}

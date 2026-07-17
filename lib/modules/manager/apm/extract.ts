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
 * the git host. Reuses `detectPlatform` (which also honors `hostRules`) to map
 * github.com/gitlab.com and their self-hosted variants to the `github-tags` and
 * `gitlab-tags` datasources, and falls back to the generic `git-tags`
 * datasource for every other host (Bitbucket, Azure DevOps, etc.).
 */
function determineDatasource(host: string, repoPath: string): DatasourceResult {
  const repoUrl = `https://${host}/${repoPath}`;
  const platform = detectPlatform(repoUrl);

  if (platform === 'github') {
    logger.debug({ repoUrl }, 'apm: found github dependency');
    return {
      datasource: GithubTagsDatasource.id,
      packageName: repoPath,
      ...(host === 'github.com' ? {} : { registryUrls: [`https://${host}`] }),
    };
  }

  if (platform === 'gitlab') {
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

/**
 * APM dependency path `[host/]owner/repo[/subpath...]`. APM only supports remote
 * git references (no local paths). The optional host prefix is always a hostname
 * (so it contains a dot), whereas owner names do not - `owner` therefore excludes
 * dots, which disambiguates the leading segment. Dots in repo names or subpaths
 * (e.g. `owner/repo.js`, `github/awesome-copilot/agents/api-architect.agent.md`)
 * are left untouched.
 */
const apmDepRegex = regEx(
  /^(?:(?<host>[^/]+\.[^/]+)\/)?(?<owner>[^/.]+)\/(?<repo>[^/]+)(?:\/.*)?$/,
);

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
    return { ...base, skipReason: 'unspecified-version' };
  }

  const groups = apmDepRegex.exec(pathPart)?.groups;
  if (!groups) {
    logger.debug({ entry }, 'apm: could not determine owner/repo');
    return {
      ...base,
      currentValue,
      skipReason: 'invalid-dependency-specification',
    };
  }

  const host = groups.host ?? 'github.com';
  const repoPath = `${groups.owner}/${groups.repo}`;
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

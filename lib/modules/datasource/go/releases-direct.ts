import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { BaseGoDatasource } from './base.ts';
import { getSourceUrl } from './common.ts';
import { getGoTagDatasource } from './tag-datasources.ts';

/**
 * This function tries to select tags with longest prefix could be constructed from `packageName`.
 *
 * For package named `example.com/foo/bar/baz/qux`, it will try to detect tags with following prefixes:
 *
 *   - `foo/bar/baz/qux/vX.Y.Z`
 *   - `bar/baz/qux/vX.Y.Z`
 *   - `baz/qux/vX.Y.Z`
 *   - `qux/vX.Y.Z`
 *
 * If none of the following is found, it falls back to simply returning all tags like `vX.Y.Z`.
 */
function filterByPrefix(packageName: string, releases: Release[]): Release[] {
  const nameParts = packageName
    .replace(regEx(/\/v\d+$/), '')
    .split('/')
    .slice(1);

  const submoduleReleases: Release[] = [];
  while (nameParts.length) {
    const prefix = `${nameParts.join('/')}/`;

    for (const release of releases) {
      if (!release.version.startsWith(prefix)) {
        continue;
      }

      const normalizedVersion = release.version.replace(prefix, '');
      if (!normalizedVersion.match(regEx(/^v\d[^/]*/))) {
        continue;
      }

      release.version = release.version.replace(prefix, '');
      submoduleReleases.push(release);
    }

    if (submoduleReleases.length) {
      return submoduleReleases;
    }

    nameParts.shift();
  }

  return releases.filter((release) => release.version.startsWith('v'));
}

/**
 * go.getReleases, resolved from the module's source repository.
 *
 * This function will:
 *  - Determine the source URL for the module
 *  - Call the respective getReleases of the git host to retrieve the tags
 *  - Filter module tags according to the module path
 */
export async function getDirectReleases(
  config: GetReleasesConfig,
): Promise<ReleaseResult | null> {
  const { packageName } = config;

  logger.trace(`go.getReleases(${packageName})`);
  const source = await BaseGoDatasource.getDatasource(packageName);

  if (!source) {
    logger.info(
      { packageName },
      'Unsupported go host - cannot look up versions',
    );
    return null;
  }

  const tagDatasource = getGoTagDatasource(source.datasource);
  /* v8 ignore next -- should never happen */
  if (!tagDatasource) {
    return null;
  }

  // `getDatasource()` resolves a registry URL for every datasource except
  // `git-tags`, which ignores it.
  const sourceConfig = { ...source, registryUrl: source.registryUrl! };

  const res = await tagDatasource.api.getReleases(sourceConfig);
  /* v8 ignore next -- TODO: add test */
  if (!res) {
    return null;
  }

  const sourceUrl = res.sourceUrl ?? getSourceUrl(source) ?? null;

  return {
    ...res,
    releases: filterByPrefix(packageName, res.releases),
    sourceUrl,
  };
}

import URL from 'url';
import { logger } from '../../../../../logger';
import * as allVersioning from '../../../../../modules/versioning';
import * as packageCache from '../../../../../util/cache/package';
import type { BranchUpgradeConfig } from '../../../../types';
import { addReleaseNotes } from './release-notes';
import { getInRangeReleases } from './releases';
import type { ChangeLogRelease, ChangeLogResult } from './types';

const cacheNamespace = 'changelog-azure-release';

export async function getChangeLogJSON(
  config: BranchUpgradeConfig
): Promise<ChangeLogResult | null> {
  const { currentVersion, newVersion, sourceDirectory, depName, manager } =
    config;
  const version = allVersioning.get(config.versioning);
  const sourceUrl = config.sourceUrl!;
  const { protocol, host, pathname } = URL.parse(sourceUrl);
  const baseUrl = `${protocol}//${host}/`;
  const repository = pathname!.slice(1).replace('_git/', '');
  const apiBaseUrl = `${baseUrl}_apis/git/`;

  const releases = config.releases ?? (await getInRangeReleases(config));
  if (!releases?.length) {
    logger.debug('No releases');
    return null;
  }
  const tagPrefix = releases.filter((r) => r.tagPrefix !== '')[0]?.tagPrefix;

  // This extra filter/sort should not be necessary, but better safe than sorry
  const validReleases = [...releases]
    .filter((release) => version.isVersion(release.version))
    .sort((a, b) => version.sortVersions(a.version, b.version));

  if (validReleases.length < 2) {
    logger.debug('Not enough valid releases');
    return null;
  }

  function getCacheKey(prev: string, next: string): string {
    return `${manager}:${depName}:${prev}:${next}`;
  }

  const changelogReleases: ChangeLogRelease[] = [];
  // compare versions
  const include = (v: string): boolean =>
    version.isGreaterThan(v, currentVersion!) &&
    !version.isGreaterThan(v, newVersion!);
  for (let i = 1; i < validReleases.length; i += 1) {
    const prev = validReleases[i - 1];
    const next = validReleases[i];
    if (include(next.version)) {
      let release = await packageCache.get(
        cacheNamespace,
        getCacheKey(prev.version, next.version)
      );
      if (!release) {
        release = {
          tagPrefix: tagPrefix,
          version: next.version,
          date: next.releaseTimestamp,
          // put empty changes so that existing templates won't break
          changes: [],
          compare: {},
        };
        if (prev.tagPrefix) {
          release.compare.url = `${sourceUrl}/branchCompare?baseVersion=GT${prev.tagPrefix}%2F${prev.version}&targetVersion=GT${next.tagPrefix}%2F${next.version}`;
        } else {
          release.compare.url = `${sourceUrl}/branchCompare?baseVersion=GT${prev.version}&targetVersion=GT${next.version}`;
        }
        const cacheMinutes = 1;
        await packageCache.set(
          cacheNamespace,
          getCacheKey(prev.version, next.version),
          release,
          cacheMinutes
        );
      }
      changelogReleases.unshift(release);
    }
  }

  let res: ChangeLogResult = {
    project: {
      apiBaseUrl,
      baseUrl,
      type: 'azure',
      repository,
      sourceUrl,
      sourceDirectory,
      depName,
      tagPrefix,
    },
    versions: changelogReleases,
  };

  res = await addReleaseNotes(res, config);

  return res;
}

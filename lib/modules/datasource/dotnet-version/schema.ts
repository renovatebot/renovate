import { z } from 'zod';
import { looseArray } from '../../../util/schema-utils';
import type { Release } from '../types';

export const ReleasesIndex = z
  .object({
    'releases-index': looseArray(
      z
        .object({
          'releases.json': z.string(),
        })
        .transform(({ 'releases.json': releasesUrl }) => releasesUrl)
    ),
  })
  .transform(({ 'releases-index': releasesIndex }) => releasesIndex);

const ReleaseBase = z.object({
  'release-date': z.string(),
  'release-notes': z.string(),
});
const ReleaseDetails = z.object({
  version: z.string(),
});

export const DotnetSdkReleases = z
  .object({
    releases: looseArray(
      ReleaseBase.extend({
        sdk: ReleaseDetails,
      })
    ),
  })
  .transform(({ releases }): Release[] =>
    releases.map(
      ({
        sdk: { version },
        'release-date': releaseTimestamp,
        'release-notes': changelogUrl,
      }) => ({ version, releaseTimestamp, changelogUrl })
    )
  );

export const DotnetRuntimeReleases = z
  .object({
    releases: looseArray(
      ReleaseBase.extend({
        runtime: ReleaseDetails,
      })
    ),
  })
  .transform(({ releases }): Release[] =>
    releases.map(
      ({
        runtime: { version },
        'release-date': releaseTimestamp,
        'release-notes': changelogUrl,
      }) => ({ version, releaseTimestamp, changelogUrl })
    )
  );

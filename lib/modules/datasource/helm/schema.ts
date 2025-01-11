import { z } from 'zod';
import { LooseRecord, Yaml } from '../../../util/schema-utils';
import type { Release } from '../types';
import { githubRelease, isPossibleChartRepo } from './common';

const HelmReleaseSchema = z.object({
  version: z.string(),
  created: z.string().nullable().catch(null),
  digest: z.string().optional().catch(undefined),
  home: z.string().optional(),
  sources: z.array(z.string()).optional(),
  urls: z.array(z.string()),
});
type HelmRelease = z.infer<typeof HelmReleaseSchema>;

function getSourceUrl(release: HelmRelease): string | null {
  // it's a github release :)
  const releaseMatch = githubRelease.exec(release.urls[0]);
  if (releaseMatch) {
    return releaseMatch[1];
  }

  if (release.home && isPossibleChartRepo(release.home)) {
    return release.home;
  }

  if (!release.sources?.length) {
    return null;
  }

  for (const url of release.sources) {
    if (isPossibleChartRepo(url)) {
      return url;
    }
  }

  // fallback
  return release.sources[0];
}

export const HelmRepositorySchema = Yaml.pipe(
  z.object({
    entries: LooseRecord(
      z.string(),
      HelmReleaseSchema.array()
        .min(1)
        .transform((helmReleases) => {
          const latestRelease = helmReleases[0];
          const homepage = latestRelease.home;
          const sourceUrl = getSourceUrl(latestRelease);
          const releases = helmReleases.map(
            ({
              version,
              created: releaseTimestamp,
              digest: newDigest,
            }): Release => ({
              version,
              releaseTimestamp,
              newDigest,
            }),
          );
          return { homepage, sourceUrl, releases };
        }),
    ),
  }),
).transform(({ entries }) => entries);

export type HelmRepositoryData = z.infer<typeof HelmRepositorySchema>;

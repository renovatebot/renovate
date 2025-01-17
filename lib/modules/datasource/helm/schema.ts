import { z } from 'zod';
import { detectPlatform } from '../../../util/common';
import { parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import { LooseRecord } from '../../../util/schema-utils';
import type { Release } from '../types';

const HelmReleaseSchema = z.object({
  version: z.string(),
  created: z.string().nullable().catch(null),
  digest: z.string().optional().catch(undefined),
  home: z.string().optional().catch(undefined),
  sources: z.array(z.string()).catch([]),
  urls: z.array(z.string()).catch([]),
});
type HelmRelease = z.infer<typeof HelmReleaseSchema>;

const chartRepo = regEx(/charts?|helm|helm-charts/i);

function isPossibleChartRepo(url: string): boolean {
  if (detectPlatform(url) === null) {
    return false;
  }

  const parsed = parseGitUrl(url);
  return chartRepo.test(parsed.name);
}

const githubRelease = regEx(
  /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\//,
);

function getSourceUrl(release: HelmRelease): string | undefined {
  // it's a github release :)
  const [githubUrl] = release.urls;
  const releaseMatch = githubRelease.exec(githubUrl);
  if (releaseMatch) {
    return releaseMatch[1];
  }

  if (release.home && isPossibleChartRepo(release.home)) {
    return release.home;
  }

  for (const url of release.sources) {
    if (isPossibleChartRepo(url)) {
      return url;
    }
  }

  // fallback
  return release.sources[0];
}

export const HelmRepositorySchema = z
  .object({
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
  })
  .transform(({ entries }) => entries);

export type HelmRepositoryData = z.infer<typeof HelmRepositorySchema>;

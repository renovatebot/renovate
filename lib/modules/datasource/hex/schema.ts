import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import type { Release, ReleaseResult } from '../types';

export const HexRelease = z
  .object({
    html_url: z.string().optional(),
    meta: z
      .object({
        links: z.object({
          Github: z.string(),
        }),
      })
      .nullable()
      .catch(null),
    releases: LooseArray(
      z.object({
        version: z.string(),
        inserted_at: z.string().optional(),
      }),
    ).refine((releases) => releases.length > 0, 'No releases found'),
  })
  .transform((hexResponse): ReleaseResult => {
    const releases: Release[] = hexResponse.releases.map(
      ({ version, inserted_at: releaseTimestamp }): Release => {
        const release: Release = { version };

        if (releaseTimestamp) {
          release.releaseTimestamp = releaseTimestamp;
        }

        return release;
      },
    );

    const releaseResult: ReleaseResult = { releases };

    if (hexResponse.html_url) {
      releaseResult.homepage = hexResponse.html_url;
    }

    if (hexResponse.meta?.links?.Github) {
      releaseResult.sourceUrl = hexResponse.meta.links.Github;
    }

    return releaseResult;
  });

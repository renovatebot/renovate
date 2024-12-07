import is from '@sindresorhus/is';
import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import type { Release, ReleaseResult } from '../types';

export const HexRelease = z
  .object({
    html_url: z.string().optional(),
    meta: z
      .object({
        links: z.union([
          z.object({ Github: z.string() }),
          z.object({ GitHub: z.string() }),
        ]),
      })
      .nullable()
      .catch(null),
    releases: LooseArray(
      z.object({
        version: z.string(),
        inserted_at: z.string().optional(),
      }),
    ).refine((releases) => releases.length > 0, 'No releases found'),
    retirements: z
      .record(
        z.string(),
        z.object({
          message: z.string().nullable(),
          reason: z.string(),
        }),
      )
      .optional(),
  })
  .transform((hexResponse): ReleaseResult => {
    const releases: Release[] = hexResponse.releases.map(
      ({ version, inserted_at: releaseTimestamp }): Release => {
        const release: Release = { version };

        if (releaseTimestamp) {
          release.releaseTimestamp = releaseTimestamp;
        }

        if (is.plainObject(hexResponse.retirements?.[version])) {
          release.isDeprecated = true;
        }

        return release;
      },
    );

    const releaseResult: ReleaseResult = { releases };

    if (hexResponse.html_url) {
      releaseResult.homepage = hexResponse.html_url;
    }

    const normalizedLinks = hexResponse.meta?.links
      ? normalizeKeys(hexResponse.meta.links)
      : undefined;

    if (normalizedLinks?.github) {
      releaseResult.sourceUrl = normalizedLinks.github;
    }

    return releaseResult;
  });

function normalizeKeys(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

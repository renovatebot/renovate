import is from '@sindresorhus/is';
import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import { MaybeTimestamp } from '../../../util/timestamp';
import type { Release, ReleaseResult } from '../types';

export const HexRelease = z
  .object({
    html_url: z.string().optional(),
    meta: z
      .object({
        links: z
          .record(z.string())
          .transform((links) =>
            Object.fromEntries(
              Object.entries(links).map(([key, value]) => [
                key.toLowerCase(),
                value,
              ]),
            ),
          )
          .pipe(
            z.object({
              github: z.string(),
            }),
          ),
      })
      .nullable()
      .catch(null),
    releases: LooseArray(
      z.object({
        version: z.string(),
        inserted_at: MaybeTimestamp,
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

    if (hexResponse.meta?.links?.github) {
      releaseResult.sourceUrl = hexResponse.meta.links.github;
    }

    return releaseResult;
  });

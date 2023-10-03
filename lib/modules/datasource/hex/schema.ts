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
      .transform((meta) => meta.links.Github)
      .nullable()
      .catch(null),
    releases: LooseArray(
      z
        .object({
          version: z.string(),
          inserted_at: z.string().optional(),
        })
        .transform(({ version, inserted_at: releaseTimestamp }): Release => {
          const release: Release = { version };

          if (releaseTimestamp) {
            release.releaseTimestamp = releaseTimestamp;
          }

          return release;
        })
    ).refine((releases) => releases.length > 0, 'No releases found'),
  })
  .transform(
    ({ releases, html_url: homepage, meta: sourceUrl }): ReleaseResult => {
      const result: ReleaseResult = { releases };

      if (homepage) {
        result.homepage = homepage;
      }

      if (sourceUrl) {
        result.sourceUrl = sourceUrl;
      }

      return result;
    }
  );

import is from '@sindresorhus/is';
import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';
import type { Release } from '../types';

export const Package = Toml.pipe(
  z
    .object({
      repo: z.string().optional(),
    })
    .transform(({ repo }) => ({ sourceUrl: repo })),
);

export const Versions = Toml.pipe(
  z
    .record(
      z.string(),
      z.object({
        yanked: z.boolean().optional(),
      }),
    )
    .refine((val) => !is.emptyObject(val), 'No versions available')
    .transform((versions) => {
      const releases: Release[] = [];

      for (const [version, { yanked }] of Object.entries(versions)) {
        const versionData: Release = { version };

        if (is.truthy(yanked)) {
          versionData.isDeprecated = yanked;
        }

        releases.push(versionData);
      }

      return { releases };
    }),
);

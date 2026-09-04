import { z } from 'zod/v4';
import { DeepNullish, LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

const OrbVersion = z
  .object({
    attributes: z.object({
      version: z.string(),
      created_at: MaybeTimestamp,
    }),
  })
  .transform(
    ({ attributes }): Release => ({
      version: attributes.version,
      releaseTimestamp: attributes.created_at,
    }),
  );

const OrbPackage = z
  .object({
    attributes: DeepNullish(
      z.object({
        is_private: z.boolean().optional(),
        home_url: z.string().optional(),
      }),
    ),
    references: z
      .object({
        orb_versions: LooseArray(OrbVersion).catch([]),
      })
      .default({ orb_versions: [] }),
  })
  .transform(({ attributes, references }) => ({
    homeUrl: attributes.home_url,
    isPrivate: !!attributes.is_private,
    releases: references.orb_versions,
  }));

export const OrbPackagesResponse = z.object({
  data: z.array(OrbPackage),
});

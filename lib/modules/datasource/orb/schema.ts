import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';
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

const OrbPackage = z.object({
  attributes: z.object({
    name: z.string(),
    is_private: z.boolean().optional().catch(undefined),
    home_url: z.string().optional().catch(undefined),
  }),
  references: z
    .object({
      orb_versions: LooseArray(OrbVersion),
    })
    .optional(),
});

export const OrbPackagesResponse = z.object({
  data: z.array(OrbPackage),
});

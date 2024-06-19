import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';

export const HexAPIPackageMetadata = z.object({
  html_url: z.string().optional(),
  meta: z
    .object({
      links: z.object({
        Github: z.string().optional(),
        Changelog: z.string().optional(),
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
});

export type HexAPIPackageMetadata = z.infer<typeof HexAPIPackageMetadata>;

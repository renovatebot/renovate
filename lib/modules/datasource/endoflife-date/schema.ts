import { DateTime } from 'luxon';
import { z } from 'zod/v3';
import { UtcDate } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

const LatestVersion = z
  .object({
    name: z.string(),
    date: MaybeTimestamp.nullable(),
    link: z.string().nullable(),
  })
  .nullable();

const ProductRelease = z.object({
  name: z.string(),
  releaseDate: MaybeTimestamp,
  isEol: z.boolean(),
  eolFrom: UtcDate.nullable(),
  isDiscontinued: z.boolean().optional(),
  discontinuedFrom: UtcDate.nullable().optional(),
  isMaintained: z.boolean(),
  latest: LatestVersion,
});

const ProductResponse = z.object({
  schema_version: z.string(),
  generated_at: z.string(),
  last_modified: z.string(),
  result: z.object({
    name: z.string(),
    releases: z.array(ProductRelease),
  }),
});

export const EndoflifeDateVersions = ProductResponse.transform(({ result }) => {
  const now = DateTime.now().toUTC();
  return result.releases.map(
    ({
      name: cycle,
      latest,
      releaseDate: releaseTimestamp,
      isEol,
      eolFrom,
      isDiscontinued,
      discontinuedFrom,
    }): Release => {
      const version = latest?.name ?? cycle;
      // A release is deprecated if it's EOL or discontinued
      let isDeprecated = isEol;
      if (isDiscontinued) {
        isDeprecated = true;
      } else if (discontinuedFrom && discontinuedFrom <= now) {
        isDeprecated = true;
      }
      return { version, releaseTimestamp, isDeprecated };
    },
  );
});

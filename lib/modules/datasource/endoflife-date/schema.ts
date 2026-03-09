import { DateTime } from 'luxon';
import { z } from 'zod/v3';
import { UtcDate } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

const ExpireableField = z.union([
  UtcDate.transform((x) => {
    const now = DateTime.now().toUTC();
    return x <= now;
  }),
  z.boolean(),
]);

export const EndoflifeDateVersions = z
  .object({
    cycle: z.string(),
    latest: z.optional(z.string()),
    releaseDate: MaybeTimestamp,
    eol: z.optional(ExpireableField),
    discontinued: z.optional(ExpireableField),
  })
  .transform(
    ({
      cycle,
      latest,
      releaseDate: releaseTimestamp,
      eol,
      discontinued,
    }): Release => {
      const version = latest ?? cycle;
      const isDeprecated = eol === true || discontinued === true;
      return { version, releaseTimestamp, isDeprecated };
    },
  )
  .array();

import { DateTime } from 'luxon';
import { z } from 'zod';
import { UtcDate } from '../../../util/schema-utils';
import type { Release } from '../types';

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
    releaseDate: z.optional(z.string()),
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

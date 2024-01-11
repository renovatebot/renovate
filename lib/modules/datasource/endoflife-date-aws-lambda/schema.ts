import { DateTime } from 'luxon';
import { z } from 'zod';
import { UtcDate } from '../../../util/schema-utils';
import type { Release } from '../types';

const AWSLambdaExpireableField = z.union([
  UtcDate.transform((x) => {
    const now = DateTime.now().toUTC();
    return x <= now;
  }),
  z.boolean(),
]);

export const EndoflifeDateAwsLambdaVersions = z
  .object({
    cycle: z.string(),
    latest: z.optional(z.string()),
    releaseDate: z.optional(z.string()),
    eol: z.optional(AWSLambdaExpireableField),
    discontinued: z.optional(AWSLambdaExpireableField),
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

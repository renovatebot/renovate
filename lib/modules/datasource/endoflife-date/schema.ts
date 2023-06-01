import { DateTime } from 'luxon';
import { z } from 'zod';
import type { Release } from '../types';

const EndoflifeDateVersionScheme = z
  .object({
    cycle: z.string(),
    latest: z.optional(z.string()),
    releaseDate: z.optional(z.string()),
    eol: z.optional(z.union([z.string(), z.boolean()])),
    discontinued: z.optional(z.union([z.string(), z.boolean()])),
  })
  .transform(({ cycle, latest, releaseDate, eol, discontinued }): Release => {
    let isDeprecated = false;

    // If "eol" date or "discontinued" date has passed or any of the values is explicitly true, set to deprecated
    // "support" is not checked because support periods sometimes end before the EOL.
    if (
      eol === true ||
      discontinued === true ||
      (typeof eol === 'string' &&
        DateTime.fromISO(eol, { zone: 'utc' }) <= DateTime.now().toUTC()) ||
      (typeof discontinued === 'string' &&
        DateTime.fromISO(discontinued, { zone: 'utc' }) <=
          DateTime.now().toUTC())
    ) {
      isDeprecated = true;
    }

    let version = cycle;
    if (latest !== undefined) {
      version = latest;
    }

    return {
      version,
      releaseTimestamp: releaseDate,
      isDeprecated,
    };
  });

export const EndoflifeHttpResponseScheme = z.array(EndoflifeDateVersionScheme);

import { z } from 'zod/v3';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const ReleaseTimestamp = z
  .object({
    version: z.object({
      created_at: MaybeTimestamp,
    }),
  })
  .transform(({ version: { created_at } }) => created_at)
  .nullable()
  .catch(null);

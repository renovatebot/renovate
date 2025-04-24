import { z } from 'zod';
import { MaybeTimestamp } from '../../../util/timestamp';

export const ReleaseTimestampSchema = z
  .object({
    version: z.object({
      created_at: MaybeTimestamp,
    }),
  })
  .transform(({ version: { created_at } }) => created_at)
  .nullable()
  .catch(null);

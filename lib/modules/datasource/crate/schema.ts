import { z } from 'zod';
import { TimestampSchema } from '../../../util/timestamp';

export const ReleaseTimestampSchema = z
  .object({
    version: z.object({
      created_at: TimestampSchema.nullable().catch(null),
    }),
  })
  .transform(({ version: { created_at } }) => created_at)
  .nullable()
  .catch(null);

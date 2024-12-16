import { z } from 'zod';

export const ReleaseTimestampSchema = z
  .object({
    version: z.object({
      created_at: z.string(),
    }),
  })
  .transform(({ version: { created_at } }) => created_at)
  .nullable()
  .catch(null);

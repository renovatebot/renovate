import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const RegistryConfig = z.object({
  dl: z.string(),
  api: z.string().optional(),
});
export type RegistryConfig = z.infer<typeof RegistryConfig>;

export const ReleaseTimestamp = z
  .object({
    version: z.object({
      created_at: MaybeTimestamp,
    }),
  })
  .transform(({ version: { created_at } }) => created_at)
  .nullable()
  .catch(null);

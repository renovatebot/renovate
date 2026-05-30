import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const RegistryConfigSchema = z.object({
  dl: z.string(),
  api: z.string().optional(),
});
export type RegistryConfigSchema = z.infer<typeof RegistryConfigSchema>;

export const ReleaseTimestamp = z
  .object({
    version: z.object({
      created_at: MaybeTimestamp,
    }),
  })
  .transform(({ version: { created_at } }) => created_at)
  .nullable()
  .catch(null);

export const CrateMetadataSchema = z.object({
  crate: z.object({
    description: z.string().optional(),
    documentation: z.string().optional(),
    homepage: z.string().optional(),
    repository: z.string().optional(),
  }),
});
export type CrateMetadataResponse = z.infer<typeof CrateMetadataSchema>;

import { z } from 'zod/v4';
import { DeepNullish, Json } from '../../../util/schema-utils/index.ts';
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

export const CrateMetadata = DeepNullish(
  z.object({
    description: z.string().optional(),
    documentation: z.string().optional(),
    homepage: z.string().optional(),
    repository: z.string().optional(),
  }),
);
export type CrateMetadata = z.infer<typeof CrateMetadata>;

export const CrateMetadataResponse = z.object({
  crate: CrateMetadata,
});
export type CrateMetadataResponse = z.infer<typeof CrateMetadataResponse>;

export const CrateZipEntry = z.object({
  path: z.string(),
  data_offset: z.number(),
  compressed_size: z.number(),
  uncompressed_size: z.number(),
  compression: z.enum(['deflate', 'store']),
  sha256: z.string(),
});
export type CrateZipEntry = z.infer<typeof CrateZipEntry>;

export const CrateZipManifest = z.object({
  files: z.array(CrateZipEntry),
});

export const CargoVcsInfo = Json.pipe(
  z.object({ path_in_vcs: z.string().default('') }),
);

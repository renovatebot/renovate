import { z } from 'zod/v4';
import { Json, LooseArray } from '../../../util/schema-utils/index.ts';

export const LibmanLibrary = z.object({
  provider: z.string().optional(),
  library: z.string(),
  destination: z.string().optional(),
  files: LooseArray(z.string()).optional(),
});
export type LibmanLibrary = z.infer<typeof LibmanLibrary>;

export const LibmanFile = Json.pipe(
  z.object({
    version: z.string().optional(),
    defaultProvider: z.string().optional(),
    libraries: LooseArray(LibmanLibrary).optional(),
  }),
);
export type LibmanFile = z.infer<typeof LibmanFile>;

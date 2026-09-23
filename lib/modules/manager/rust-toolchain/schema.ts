import { z } from 'zod/v4';
import { Toml } from '../../../util/schema-utils/index.ts';

export const RustToolchain = Toml.pipe(
  z.object({
    toolchain: z.object({
      channel: z.string().optional(),
      path: z.string().optional(),
    }),
  }),
);

export type RustToolchain = z.infer<typeof RustToolchain>;

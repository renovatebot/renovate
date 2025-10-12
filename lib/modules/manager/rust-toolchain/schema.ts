import { z } from 'zod/v3';
import { Toml } from '../../../util/schema-utils/index.ts';

export const RustToolchain = Toml.pipe(
  z.object({
    toolchain: z.object({
      channel: z.string(),
    }),
  }),
);

export type RustToolchain = z.infer<typeof RustToolchain>;

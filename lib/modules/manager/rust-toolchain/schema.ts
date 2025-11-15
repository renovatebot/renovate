import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

export const RustToolchain = Toml.pipe(
  z.object({
    toolchain: z.object({
      channel: z.string(),
    }),
  }),
);

export type RustToolchain = z.infer<typeof RustToolchain>;

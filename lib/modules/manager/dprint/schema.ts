import { z } from 'zod/v4';
import { Jsonc } from '../../../util/schema-utils/index.ts';

export const DprintConfig = Jsonc.pipe(
  z.object({
    plugins: z.array(z.string()).optional(),
  }),
);

export type DprintConfig = z.infer<typeof DprintConfig>;

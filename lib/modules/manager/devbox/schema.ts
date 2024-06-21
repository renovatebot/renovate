import { z } from 'zod';
import { Jsonc } from '../../../util/schema-utils';

export const DevboxFile = Jsonc.pipe(
  z.object({
    packages: z.union([
      z.array(z.string()),
      z.record(z.union([z.string(), z.object({ version: z.string() })])),
    ]),
  }),
);

export type DevboxFile = z.infer<typeof DevboxFile>;

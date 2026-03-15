import { z } from 'zod/v3';
import { Jsonc, LooseRecord } from '../../../util/schema-utils/index.ts';

export const DevContainerFile = Jsonc.pipe(
  z.object({
    image: z.string().optional(),
    features: LooseRecord(
      z.object({
        version: z.string().optional(),
      }),
    ).optional(),
  }),
);

export type DevContainerFile = z.infer<typeof DevContainerFile>;

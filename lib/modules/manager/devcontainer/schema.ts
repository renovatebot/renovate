import { z } from 'zod';
import { Jsonc, LooseRecord } from '../../../util/schema-utils';

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

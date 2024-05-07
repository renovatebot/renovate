import { z } from 'zod';
import { Jsonc } from '../../../util/schema-utils';

export const DevContainerFile = Jsonc.pipe(
  z.object({
    image: z.string().optional(),
    features: z.record(z.unknown()).optional(),
  }),
);

export type DevContainerFile = z.infer<typeof DevContainerFile>;

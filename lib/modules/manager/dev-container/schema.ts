import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

export const DevContainerFile = Json.pipe(
  z.object({
    image: z.string().optional(),
    features: z.record(z.unknown()).optional(),
  }),
);

export type DevContainerFile = z.infer<typeof DevContainerFile>;

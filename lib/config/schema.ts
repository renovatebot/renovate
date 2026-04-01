import { z } from 'zod/v3';
import { Json } from '../util/schema-utils/index.ts';

export const DecryptedObject = Json.pipe(
  z.object({
    o: z.string().optional(),
    r: z.string().optional(),
    v: z.string().optional(),
  }),
);

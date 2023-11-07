import { z } from 'zod';
import { Json } from '../util/schema-utils';

export const DecryptedObject = Json.pipe(
  z.object({
    o: z.string().optional(),
    r: z.string().optional(),
    v: z.string().optional(),
  }),
);

import { z } from 'zod';

export const DecryptedObject = z.object({
  o: z.string().optional(),
  r: z.string().optional(),
  v: z.string().optional(),
});

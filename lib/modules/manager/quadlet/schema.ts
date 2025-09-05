import ini from 'ini';
import { z } from 'zod';

export const Ini = z.string().transform((str, ctx): Record<string, any> => {
  return ini.parse(str);
});

export const QuadletFile = z.object({
  Container: z
    .object({
      Image: z.string(),
    })
    .optional(),
  Image: z
    .object({
      Image: z.string(),
    })
    .optional(),
  Volume: z
    .object({
      Image: z.string(),
    })
    .optional(),
});
export type QuadletFile = z.infer<typeof QuadletFile>;

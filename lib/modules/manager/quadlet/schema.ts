import ini from 'ini';
import { z } from 'zod';

export const Ini = z.string().transform((str, ctx): Record<string, any> => {
  try {
    return ini.parse(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid INI' });
    return z.NEVER;
  }
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

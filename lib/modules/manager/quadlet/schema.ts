import { z } from 'zod';
import ini from 'ini';

export const Ini = z.string().transform(
  (
    str,
    ctx,
  ): {
    [key: string]: any;
  } => {
    try {
      return ini.parse(str);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid INI' });
      return z.NEVER;
    }
  },
);

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

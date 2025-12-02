import { z } from 'zod';
import { Ini } from '../../../util/schema-utils';

export const QuadletFile = Ini.pipe(
  z.object({
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
  }),
);
export type QuadletFile = z.infer<typeof QuadletFile>;

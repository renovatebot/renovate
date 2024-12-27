import { type ZodEffects, type ZodString, z } from 'zod';
import { regEx } from '../../../util/regex';
import { Json } from '../../../util/schema-utils';

const stringIsBoolSchema: ZodEffects<ZodString, boolean, string> = z
  .string()
  .transform((value) => {
    if (value === 'true') {
      return true;
    } else if (value === 'false') {
      return false;
    } else {
      return false;
    }
  });

export const EksFilterSchema = z.object({
  default: z.oboolean().or(stringIsBoolSchema),
  region: z.string().regex(regEx('^[a-z0-9][a-z0-9-]*[0-9]$')).optional(),
  profile: z.string().optional(),
});

export type EksFilter = z.infer<typeof EksFilterSchema>;
export const EksFilter = Json.pipe(EksFilterSchema);

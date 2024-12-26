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

export const EksAddonsFilterSchema = z.object({
  addonName: z.string().nonempty().regex(regEx('^[a-z0-9][a-z0-9-]*[a-z0-9]$')),
  kubernetesVersion: z
    .string()
    .regex(regEx('^(?<major>\\d+)\\.(?<minor>\\d+)$'))
    .optional(),
  default: z.oboolean().or(stringIsBoolSchema),
  region: z.string().optional(),
  profile: z.string().optional(),
});

export type EksAddonsFilter = z.infer<typeof EksAddonsFilterSchema>;
export const EksAddonsFilter = Json.pipe(EksAddonsFilterSchema);

import { z } from 'zod/v4';
import { regEx } from '../../../util/regex';
import { Json } from '../../../util/schema-utils/v4';

export const EksAddonsFilter = Json.pipe(
  z.object({
    addonName: z
      .string()
      .nonempty()
      .regex(regEx('^[a-z0-9][a-z0-9-]*[a-z0-9]$')),
    kubernetesVersion: z
      .string()
      .regex(regEx('^(?<major>\\d+)\\.(?<minor>\\d+)$'))
      .optional(),
    default: z
      .union([z.boolean(), z.string().transform((value) => value === 'true')])
      .optional(),
    region: z.string().optional(),
    profile: z.string().optional(),
  }),
);

export type EksAddonsFilter = z.infer<typeof EksAddonsFilter>;

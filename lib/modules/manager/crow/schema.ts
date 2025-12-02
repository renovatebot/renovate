import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

export const CrowStep = z.object({
  image: z.string().optional(),
});

export const CrowStepWithName = CrowStep.extend({
  name: z.string(),
});

export const CrowConfig = Yaml.pipe(
  z.object({
    pipeline: z
      .union([z.record(z.string(), CrowStep), z.array(CrowStepWithName)])
      .optional(),
    steps: z
      .union([z.record(z.string(), CrowStep), z.array(CrowStepWithName)])
      .optional(),
    clone: z.record(z.string(), CrowStep).optional(),
    services: z.record(z.string(), CrowStep).optional(),
  }),
);

export type CrowConfig = z.infer<typeof CrowConfig>;
export type CrowStep = z.infer<typeof CrowStep>;

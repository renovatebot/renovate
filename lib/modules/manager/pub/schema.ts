import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

export const PubspecLockSchema = z.object({
  sdks: z.object({
    dart: z.string(),
    flutter: z.string().optional(),
  }),
});

export type PubspecLockSchema = z.infer<typeof PubspecLockSchema>;

export const PubspecLockYaml = Yaml.pipe(PubspecLockSchema);

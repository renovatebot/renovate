import { z } from 'zod';
import { LooseRecord, Yaml } from '../../../util/schema-utils';

const PubspecDependencySchema = LooseRecord(
  z.string(),
  z.union([
    z.string(),
    z.object({
      version: z.string().optional(),
      path: z.string().optional(),
      hosted: z.union([
        z.string().optional(),
        z.object({ name: z.string().optional(), url: z.string().optional() }),
      ]),
    }),
  ]),
);

export const PubspecSchema = z.object({
  environment: z.object({ sdk: z.string(), flutter: z.string().optional() }),
  dependencies: PubspecDependencySchema.optional(),
  dev_dependencies: PubspecDependencySchema.optional(),
});

export type PubspecSchema = z.infer<typeof PubspecSchema>;

export const PubspecYaml = Yaml.pipe(PubspecSchema);

export const PubspecLockSchema = z.object({
  sdks: z.object({
    dart: z.string(),
    flutter: z.string().optional(),
  }),
});

export type PubspecLockSchema = z.infer<typeof PubspecLockSchema>;

export const PubspecLockYaml = Yaml.pipe(PubspecLockSchema);

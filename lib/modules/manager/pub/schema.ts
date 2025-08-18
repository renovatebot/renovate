import { z } from 'zod';
import { LooseRecord, Yaml } from '../../../util/schema-utils';

const PubspecDependency = LooseRecord(
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

export const Pubspec = Yaml.pipe(
  z.object({
    environment: z.object({ sdk: z.string(), flutter: z.string().optional() }),
    dependencies: PubspecDependency.optional(),
    dev_dependencies: PubspecDependency.optional(),
  }),
);

export type Pubspec = z.infer<typeof Pubspec>;

export const PubspecLock = Yaml.pipe(
  z.object({
    sdks: z.object({
      dart: z.string(),
      flutter: z.string().optional(),
    }),
  }),
);

export type PubspecLock = z.infer<typeof PubspecLock>;

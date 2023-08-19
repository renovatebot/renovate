import { z } from 'zod';
import { LooseRecord, Toml } from '../../../util/schema-utils';

const PoetryDependencySchema = z.object({
  path: z.string().optional(),
  git: z.string().optional(),
  tag: z.string().optional(),
  version: z.string().optional(),
});

export const PoetryDependencyRecord = LooseRecord(
  z.string(),
  z.union([PoetryDependencySchema, z.array(PoetryDependencySchema), z.string()])
);

export type PoetryDependencyRecord = z.infer<typeof PoetryDependencyRecord>;

export const PoetryGroupRecord = LooseRecord(
  z.string(),
  z.object({
    dependencies: PoetryDependencyRecord.optional(),
  })
);

export type PoetryGroupRecord = z.infer<typeof PoetryGroupRecord>;

export const PoetrySectionSchema = z.object({
  dependencies: PoetryDependencyRecord.optional(),
  'dev-dependencies': PoetryDependencyRecord.optional(),
  extras: PoetryDependencyRecord.optional(),
  group: PoetryGroupRecord.optional(),
  source: z
    .array(z.object({ name: z.string(), url: z.string().optional() }))
    .optional(),
});

export type PoetrySectionSchema = z.infer<typeof PoetrySectionSchema>;

export const PoetrySchema = z.object({
  tool: z
    .object({
      poetry: PoetrySectionSchema.optional(),
    })
    .optional(),
  'build-system': z
    .object({
      requires: z.array(z.string()),
      'build-backend': z.string().optional(),
    })
    .optional(),
});

export type PoetrySchema = z.infer<typeof PoetrySchema>;

export const PoetrySchemaToml = Toml.pipe(PoetrySchema);

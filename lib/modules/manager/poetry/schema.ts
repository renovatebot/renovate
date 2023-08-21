import { z } from 'zod';
import { LooseArray, LooseRecord, Toml } from '../../../util/schema-utils';

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

const poetryConstraint: Record<string, string> = {
  '1.0': '<1.1.0',
  '1.1': '<1.3.0',
  '2.0': '>=1.3.0',
};

export const Lockfile = Toml.pipe(
  z.object({
    package: LooseArray(
      z
        .object({
          name: z.string(),
          version: z.string(),
        })
        .transform(({ name, version }): [string, string] => [name, version])
    )
      .transform((entries) => Object.fromEntries(entries))
      .catch({}),
    metadata: z
      .object({
        'lock-version': z
          .string()
          .transform((lockVersion) => poetryConstraint[lockVersion])
          .optional()
          .catch(undefined),
        'python-versions': z.string().optional().catch(undefined),
      })
      .transform(
        ({
          'lock-version': poetryConstraint,
          'python-versions': pythonVersions,
        }) => ({
          poetryConstraint,
          pythonVersions,
        })
      )
      .catch({
        poetryConstraint: undefined,
        pythonVersions: undefined,
      }),
  })
).transform(
  ({ package: lock, metadata: { poetryConstraint, pythonVersions } }) => ({
    lock,
    poetryConstraint,
    pythonVersions,
  })
);

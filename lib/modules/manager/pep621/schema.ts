import { z } from 'zod';
import { LooseArray, Toml } from '../../../util/schema-utils';
import { normalizePythonDepName } from '../../datasource/pypi/common';

export type PyProject = z.infer<typeof PyProjectSchema>;

const DependencyListSchema = z.array(z.string()).optional();
const DependencyRecordSchema = z
  .record(z.string(), z.array(z.string()))
  .optional();

const PdmSchema = z.object({
  'dev-dependencies': DependencyRecordSchema,
  source: z
    .array(
      z.object({
        url: z.string(),
        name: z.string(),
        verify_ssl: z.boolean().optional(),
      }),
    )
    .optional(),
});

const HatchSchema = z.object({
  envs: z
    .record(
      z.string(),
      z
        .object({
          dependencies: DependencyListSchema,
          'extra-dependencies': DependencyListSchema,
        })
        .optional(),
    )
    .optional(),
});

// https://docs.astral.sh/uv/concepts/dependencies/#dependency-sources
const UvSource = z.object({
  git: z.string().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  workspace: z.boolean().optional(),
});

const UvSchema = z.object({
  'dev-dependencies': DependencyListSchema,
  sources: z
    .record(
      // uv applies the same normalization as for Python dependencies on sources
      z.string().transform((source) => normalizePythonDepName(source)),
      UvSource,
    )
    .optional(),
});

export const PyProjectSchema = z.object({
  project: z
    .object({
      version: z.string().optional().catch(undefined),
      'requires-python': z.string().optional(),
      dependencies: DependencyListSchema,
      'optional-dependencies': DependencyRecordSchema,
    })
    .optional(),
  'build-system': z
    .object({
      requires: DependencyListSchema,
      'build-backend': z.string().optional(),
    })
    .optional(),
  tool: z
    .object({
      pdm: PdmSchema.optional(),
      hatch: HatchSchema.optional(),
      uv: UvSchema.optional(),
    })
    .optional(),
});

export const PdmLockfileSchema = Toml.pipe(
  z.object({
    package: LooseArray(
      z.object({
        name: z.string(),
        version: z.string(),
      }),
    ),
  }),
)
  .transform(({ package: pkg }) =>
    Object.fromEntries(
      pkg.map(({ name, version }): [string, string] => [name, version]),
    ),
  )
  .transform((lock) => ({ lock }));

export const UvLockfileSchema = Toml.pipe(
  z.object({
    package: LooseArray(
      z.object({
        name: z.string(),
        version: z.string(),
      }),
    ),
  }),
).transform(({ package: pkg }) =>
  Object.fromEntries(
    pkg.map(({ name, version }): [string, string] => [name, version]),
  ),
);

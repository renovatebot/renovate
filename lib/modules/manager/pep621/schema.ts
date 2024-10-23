import { z } from 'zod';
import { LooseArray, LooseRecord, Toml } from '../../../util/schema-utils';

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

const UvGitSource = z.object({
  git: z.string(),
  rev: z.string().optional(),
  tag: z.string().optional(),
  branch: z.string().optional(),
});
export type UvGitSource = z.infer<typeof UvGitSource>;

const UvUrlSource = z.object({
  url: z.string(),
});

const UvPathSource = z.object({
  path: z.string(),
});

const UvWorkspaceSource = z.object({
  workspace: z.literal(true),
});

// https://docs.astral.sh/uv/concepts/dependencies/#dependency-sources
const UvSource = z.union([
  UvGitSource,
  UvUrlSource,
  UvPathSource,
  UvWorkspaceSource,
]);

const UvSchema = z.object({
  'dev-dependencies': DependencyListSchema,
  sources: LooseRecord(z.string(), UvSource).optional(),
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

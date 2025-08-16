import { z } from 'zod';
import { LooseArray, LooseRecord, Toml } from '../../../util/schema-utils';
import { PypiDatasource } from '../../datasource/pypi';
import { normalizePythonDepName } from '../../datasource/pypi/common';
import type { PackageDependency } from '../types';
import { depTypes, pep508ToPackageDependency } from './utils';

type Pep508Dependency = z.ZodType<PackageDependency<Record<string, any>>>;

function Pep508Dependency(depType: string): Pep508Dependency {
  return z.string().transform((x, ctx) => {
    const res = pep508ToPackageDependency(depType, x);

    if (!res) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'should be a valid PEP508 dependency',
        fatal: true,
      });

      return z.NEVER;
    }

    return res;
  }) as Pep508Dependency;
}

type DependencyGroup = z.ZodType<PackageDependency<Record<string, any>>[]>;

function DependencyGroup(depType: string): DependencyGroup {
  return LooseRecord(LooseArray(Pep508Dependency(depType))).transform(
    (depGroups) => {
      const deps: PackageDependency[] = [];
      for (const [depGroup, groupDeps] of Object.entries(depGroups)) {
        for (const dep of groupDeps) {
          if (dep.packageName) {
            dep.depName = dep.packageName;
          }
          dep.managerData = { depGroup };
          deps.push(dep);
        }
      }
      return deps;
    },
  ) as unknown as DependencyGroup;
}

const PdmConfig = z
  .object({
    'dev-dependencies': DependencyGroup(depTypes.pdmDevDependencies).catch([]),
    source: LooseArray(
      z.object({
        url: z.string(),
        name: z.string(),
      }),
    )
      .transform((pdmSource) => {
        const registryUrls: string[] = [];

        let containsPyPiUrl = false;
        for (const source of pdmSource) {
          if (source.name === 'pypi') {
            containsPyPiUrl = true;
          }

          registryUrls.push(source.url);
        }

        // Add pypi default url, if there is no source declared with the name `pypi`
        // @see https://daobook.github.io/pdm/pyproject/tool-pdm/#specify-other-sources-for-finding-packages
        if (!containsPyPiUrl) {
          registryUrls.unshift(PypiDatasource.defaultURL);
        }

        return registryUrls;
      })
      .optional()
      .catch(undefined),
  })
  .transform(
    ({ 'dev-dependencies': devDependencies, source: registryUrls }) => ({
      devDependencies,
      registryUrls,
    }),
  );

const HatchConfig = z
  .object({
    envs: LooseRecord(
      z.string(),
      z.object({
        dependencies: z.unknown(),
        'extra-dependencies': z.unknown(),
      }),
    ),
  })
  .catch({ envs: {} })
  .transform(({ envs }) => {
    const deps: PackageDependency[] = [];
    for (const [
      envName,
      { dependencies, 'extra-dependencies': extraDependencies },
    ] of Object.entries(envs)) {
      const depType = `tool.hatch.envs.${envName}`;
      const HatchDependency = LooseArray(Pep508Dependency(depType)).catch([]);
      deps.push(
        ...HatchDependency.parse(dependencies),
        ...HatchDependency.parse(extraDependencies),
      );
    }
    return { deps };
  });

const UvIndexSource = z.object({
  index: z.string(),
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
  UvIndexSource,
  UvGitSource,
  UvUrlSource,
  UvPathSource,
  UvWorkspaceSource,
]);

const UvConfig = z.object({
  'dev-dependencies': LooseArray(
    Pep508Dependency(depTypes.uvDevDependencies),
  ).catch([]),
  'required-version': z.string().optional(),
  sources: LooseRecord(
    // uv applies the same normalization as for Python dependencies on sources
    z.string().transform((source) => normalizePythonDepName(source)),
    UvSource,
  ).optional(),
  index: z
    .array(
      z.object({
        name: z.string().optional(),
        url: z.string(),
        default: z.boolean().default(false),
        explicit: z.boolean().default(false),
      }),
    )
    .optional(),
});

export const ProjectSection = z.object({
  version: z.string().optional().catch(undefined),
  'requires-python': z.string().optional().catch(undefined),
  dependencies: LooseArray(Pep508Dependency(depTypes.dependencies)).catch([]),
  'optional-dependencies': DependencyGroup(depTypes.optionalDependencies).catch(
    [],
  ),
});

export const PyProject = z.object({
  project: ProjectSection.optional().catch(undefined),
  'build-system': z
    .object({
      requires: LooseArray(
        Pep508Dependency(depTypes.buildSystemRequires),
      ).catch([]),
      'build-backend': z.string().optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  'dependency-groups': DependencyGroup(depTypes.dependencyGroups).catch([]),
  tool: z
    .object({
      pdm: PdmConfig.optional().catch(undefined),
      hatch: HatchConfig.optional().catch(undefined),
      uv: UvConfig.optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});
export type PyProject = z.infer<typeof PyProject>;

export const PdmLockfile = Toml.pipe(
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

export const UvLockfile = Toml.pipe(
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

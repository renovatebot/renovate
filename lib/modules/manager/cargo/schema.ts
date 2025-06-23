import { z } from 'zod';
import type { SkipReason } from '../../../types';
import { Toml, withDepType } from '../../../util/schema-utils';
import { CrateDatasource } from '../../datasource/crate';
import type { PackageDependency } from '../types';
import type { CargoManagerData } from './types';

const CargoDep = z.union([
  z
    .object({
      /** Path on disk to the crate sources */
      path: z.string().optional(),
      /** Git URL for the dependency */
      git: z.string().optional(),
      /** Semver version */
      version: z.string().optional(),
      /** Name of a registry whose URL is configured in `.cargo/config.toml` or `.cargo/config` */
      registry: z.string().optional(),
      /** Name of a package to look up */
      package: z.string().optional(),
      /** Whether the dependency is inherited from the workspace */
      workspace: z.boolean().optional(),
    })
    .transform(
      ({
        path,
        git,
        version,
        registry,
        package: pkg,
        workspace,
      }): PackageDependency<CargoManagerData> => {
        let skipReason: SkipReason | undefined;
        let currentValue: string | undefined;
        let nestedVersion = false;

        if (version) {
          currentValue = version;
          nestedVersion = true;
        } else {
          currentValue = '';
          skipReason = 'invalid-dependency-specification';
        }

        if (path) {
          skipReason = 'path-dependency';
        } else if (git) {
          skipReason = 'git-dependency';
        } else if (workspace) {
          skipReason = 'inherited-dependency';
        }

        const dep: PackageDependency<CargoManagerData> = {
          currentValue,
          managerData: { nestedVersion },
          datasource: CrateDatasource.id,
        };

        if (skipReason) {
          dep.skipReason = skipReason;
        }
        if (pkg) {
          dep.packageName = pkg;
        }
        if (registry) {
          dep.managerData!.registryName = registry;
        }

        return dep;
      },
    ),
  z.string().transform(
    (version): PackageDependency<CargoManagerData> => ({
      currentValue: version,
      managerData: { nestedVersion: false },
      datasource: CrateDatasource.id,
    }),
  ),
]);

const CargoDeps = z.record(z.string(), CargoDep).transform((record) => {
  const deps: PackageDependency[] = [];

  for (const [depName, dep] of Object.entries(record)) {
    dep.depName = depName;
    deps.push(dep);
  }

  return deps;
});

export type CargoDeps = z.infer<typeof CargoDeps>;

const CargoSection = z.object({
  dependencies: withDepType(CargoDeps, 'dependencies').optional(),
  'dev-dependencies': withDepType(CargoDeps, 'dev-dependencies').optional(),
  'build-dependencies': withDepType(CargoDeps, 'build-dependencies').optional(),
});

const CargoWorkspace = z.object({
  dependencies: withDepType(CargoDeps, 'workspace.dependencies').optional(),
  package: z
    .object({
      version: z.string().optional(),
    })
    .optional(),
});

const CargoTarget = z.record(z.string(), CargoSection);

export const CargoManifestSchema = Toml.pipe(
  CargoSection.extend({
    package: z
      .object({
        version: z
          .union([z.string(), z.object({ workspace: z.literal(true) })])
          .optional(),
      })
      .optional(),
    workspace: CargoWorkspace.optional(),
    target: CargoTarget.optional(),
  }),
);

const CargoConfigRegistry = z.object({
  index: z.string().optional(),
});

const CargoConfigSource = z.object({
  'replace-with': z.string().optional(),
  registry: z.string().optional(),
});

export const CargoConfigSchema = Toml.pipe(
  z.object({
    registries: z.record(z.string(), CargoConfigRegistry).optional(),
    source: z.record(z.string(), CargoConfigSource).optional(),
  }),
);

export type CargoConfig = z.infer<typeof CargoConfigSchema>;

const CargoLockPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  source: z.string().optional(),
});

export const CargoLockSchema = z.object({
  package: z.array(CargoLockPackageSchema).optional(),
});

export type CargoLockSchema = z.infer<typeof CargoLockSchema>;

export const CargoLockSchemaToml = Toml.pipe(CargoLockSchema);

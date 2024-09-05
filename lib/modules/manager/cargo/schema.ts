import { z } from 'zod';
import type { SkipReason } from '../../../types';
import { Toml } from '../../../util/schema-utils';
import { CrateDatasource } from '../../datasource/crate';
import type { PackageDependency } from '../types';

const CargoDep = z.union([
  z
    .object({
      path: z.string().optional(),
      git: z.string().optional(),
      version: z.string().optional(),
      registry: z.string().optional(),
      package: z.string().optional(),
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
      }): PackageDependency => {
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

        const dep: PackageDependency = {
          currentValue: currentValue as any,
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
          dep.managerData!.registry = registry;
        }

        return dep;
      },
    ),
  z.string().transform(
    (version): PackageDependency => ({
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
  dependencies: CargoDeps.transform((record) => {
    const deps: PackageDependency[] = [];

    for (const dep of Object.values(record)) {
      dep.depType = 'dependencies';
      deps.push(dep);
    }

    return deps;
  }).optional(),
  'dev-dependencies': CargoDeps.transform((record) => {
    const deps: PackageDependency[] = [];

    for (const dep of Object.values(record)) {
      dep.depType = 'dev-dependencies';
      deps.push(dep);
    }

    return deps;
  }).optional(),
  'build-dependencies': CargoDeps.transform((record) => {
    const deps: PackageDependency[] = [];

    for (const dep of Object.values(record)) {
      dep.depType = 'build-dependencies';
      deps.push(dep);
    }

    return deps;
  }).optional(),
});

const CargoWorkspace = z.object({
  dependencies: CargoDeps.transform((record) => {
    const deps: PackageDependency[] = [];

    for (const dep of Object.values(record)) {
      dep.depType = 'workspace.dependencies';
      deps.push(dep);
    }

    return deps;
  }).optional(),
});

const CargoTarget = z.record(z.string(), CargoSection);

export const CargoManifestSchema = Toml.pipe(
  CargoSection.extend({
    package: z.object({ version: z.string().optional() }).optional(),
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

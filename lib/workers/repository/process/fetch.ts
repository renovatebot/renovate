// TODO #22198
import is from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { ManagerConfig, RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getDefaultConfig } from '../../../modules/datasource';
import { getDefaultVersioning } from '../../../modules/datasource/common';
import type {
  PackageDependency,
  PackageFile,
} from '../../../modules/manager/types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { clone } from '../../../util/clone';
import { applyPackageRules } from '../../../util/package-rules';
import * as p from '../../../util/promises';
import { Result } from '../../../util/result';
import { LookupStats } from '../../../util/stats';
import { PackageFiles } from '../package-files';
import { lookupUpdates } from './lookup';
import type { LookupUpdateConfig, UpdateResult } from './lookup/types';

type LookupResult = Result<PackageDependency, Error>;

interface LookupTaskResult {
  packageFile: PackageFile;
  manager: string;
  result: LookupResult;
}

type LookupTask = Promise<LookupTaskResult>;

async function lookup(
  packageFileConfig: ManagerConfig & PackageFile,
  indep: PackageDependency,
): Promise<LookupResult> {
  const dep = clone(indep);
  dep.updates = [];

  if (dep.skipReason) {
    return Result.ok(dep);
  }

  if (is.string(dep.depName)) {
    dep.depName = dep.depName.trim();
  }

  dep.packageName ??= dep.depName;
  if (!is.nonEmptyString(dep.packageName)) {
    dep.skipReason = 'invalid-name';
    return Result.ok(dep);
  }

  if (dep.isInternal && !packageFileConfig.updateInternalDeps) {
    dep.skipReason = 'internal-package';
    return Result.ok(dep);
  }

  const { depName } = dep;
  // TODO: fix types
  let depConfig = mergeChildConfig(packageFileConfig, dep);
  const datasourceDefaultConfig = await getDefaultConfig(depConfig.datasource!);
  depConfig = mergeChildConfig(depConfig, datasourceDefaultConfig);
  depConfig.versioning ??= getDefaultVersioning(depConfig.datasource);
  depConfig = await applyPackageRules(depConfig, 'pre-lookup');
  depConfig.packageName ??= depConfig.depName;

  if (depConfig.ignoreDeps!.includes(depName!)) {
    // TODO: fix types (#22198)
    logger.debug(`Dependency: ${depName!}, is ignored`);
    dep.skipReason = 'ignored';
    return Result.ok(dep);
  }

  if (depConfig.enabled === false) {
    logger.debug(`Dependency: ${depName!}, is disabled`);
    dep.skipReason = 'disabled';
    return Result.ok(dep);
  }

  if (!depConfig.datasource) {
    return Result.ok(dep);
  }

  return LookupStats.wrap(depConfig.datasource, async () => {
    return await Result.wrap(lookupUpdates(depConfig as LookupUpdateConfig))
      .onValue((dep) => {
        logger.trace({ dep }, 'Dependency lookup success');
      })
      .onError((err) => {
        logger.trace({ err, depName }, 'Dependency lookup error');
      })
      .catch((err): Result<UpdateResult, Error> => {
        if (
          packageFileConfig.repoIsOnboarded === true ||
          !(err instanceof ExternalHostError)
        ) {
          return Result.err(err);
        }

        const cause = err.err;
        return Result.ok({
          updates: [],
          warnings: [
            {
              topic: 'Lookup Error',
              message: `${depName}: ${cause.message}`,
            },
          ],
        });
      })
      .transform((upd): PackageDependency => Object.assign(dep, upd));
  });
}

function createLookupTasks(
  config: RenovateConfig,
  managerPackageFiles: Record<string, PackageFile[]>,
): LookupTask[] {
  const lookupTasks: LookupTask[] = [];

  for (const [manager, packageFiles] of Object.entries(managerPackageFiles)) {
    const managerConfig = getManagerConfig(config, manager);

    for (const packageFile of packageFiles) {
      const packageFileConfig = mergeChildConfig(managerConfig, packageFile);
      if (packageFile.extractedConstraints) {
        packageFileConfig.constraints = {
          ...packageFile.extractedConstraints,
          ...config.constraints,
        };
      }

      const uniqueDeps = new Set<string>();
      for (const dep of packageFile.deps) {
        if (dep.depName) {
          if (uniqueDeps.has(dep.depName)) {
            continue;
          }

          uniqueDeps.add(dep.depName);
        }

        lookupTasks.push(
          lookup(packageFileConfig, dep).then((result) => ({
            packageFile,
            manager: managerConfig.manager,
            result,
          })),
        );
      }
    }
  }

  return lookupTasks;
}

export async function fetchUpdates(
  config: RenovateConfig,
  managerPackageFiles: Record<string, PackageFile[]>,
): Promise<void> {
  logger.debug(
    { baseBranch: config.baseBranch },
    'Starting package releases lookups',
  );

  const allTasks = createLookupTasks(config, managerPackageFiles);

  const fetchResults = await Promise.all(allTasks);

  const errors: Error[] = [];

  type Manager = string;
  type PackageDeps = WeakMap<PackageFile, PackageDependency[]>;
  type ManagerPackageDeps = Record<Manager, PackageDeps>;
  const managerPackageDeps: ManagerPackageDeps = {};

  // Separate good results from errors
  for (const { packageFile, manager, result } of fetchResults) {
    const { val: dep, err } = result.unwrap();
    if (dep) {
      managerPackageDeps[manager] ??= new WeakMap();
      let deps = managerPackageDeps[manager].get(packageFile);
      if (!deps) {
        deps = [];
        managerPackageDeps[manager].set(packageFile, deps);
      }
      deps.push(dep);
    } else {
      errors.push(err);
    }
  }

  if (errors.length) {
    p.handleMultipleErrors(errors);
  }

  // Assign fetched deps back to packageFiles
  for (const [manager, packageFiles] of Object.entries(managerPackageFiles)) {
    for (const packageFile of packageFiles) {
      const packageFileDeps = managerPackageDeps[manager]?.get(packageFile);
      if (packageFileDeps) {
        packageFile.deps = packageFileDeps;
      }
    }
  }

  PackageFiles.add(config.baseBranch!, { ...managerPackageFiles });
  logger.debug(
    { baseBranch: config.baseBranch },
    'Package releases lookups complete',
  );
}

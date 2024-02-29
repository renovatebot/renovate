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
import * as memCache from '../../../util/cache/memory';
import type { LookupStats } from '../../../util/cache/memory/types';
import { clone } from '../../../util/clone';
import { applyPackageRules } from '../../../util/package-rules';
import * as p from '../../../util/promises';
import { Result } from '../../../util/result';
import { PackageFiles } from '../package-files';
import { lookupUpdates } from './lookup';
import type { LookupUpdateConfig, UpdateResult } from './lookup/types';

type LookupResult = Result<PackageDependency, Error>;

interface LookupTaskResult {
  packageFileName: string;
  manager: string;
  result: LookupResult;
}

type LookupTask = () => Promise<LookupTaskResult>;

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
  depConfig = applyPackageRules(depConfig);
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

  logger.trace({ depName }, 'Dependency lookup start');
  const start = Date.now();

  const result = await Result.wrap(
    lookupUpdates(depConfig as LookupUpdateConfig),
  )
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
          { topic: 'Lookup Error', message: `${depName}: ${cause.message}` },
        ],
      });
    })
    .transform((upd): PackageDependency => Object.assign(dep, upd));

  const duration = Date.now() - start;
  const lookups = memCache.get<LookupStats[]>('lookup-stats') || [];
  lookups.push({ datasource: depConfig.datasource, duration });
  memCache.set('lookup-stats', lookups);

  return result;
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

      for (const dep of packageFile.deps) {
        const lookupTask: LookupTask = async () => {
          const result = await lookup(packageFileConfig, dep);
          return {
            packageFileName: packageFile.packageFile,
            manager: managerConfig.manager,
            result,
          };
        };
        lookupTasks.push(lookupTask);
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

  const fetchResults = await p.all(allTasks, { concurrency: Infinity });

  const errors: Error[] = [];

  type Manager = string;
  type PackageFileName = string;
  type PackageFileDeps = Record<PackageFileName, PackageDependency[]>;
  type ManagerPackageFileDeps = Record<Manager, PackageFileDeps>;
  const deps: ManagerPackageFileDeps = {};

  // Separate good results from errors
  for (const { packageFileName, manager, result } of fetchResults) {
    const { val: dep, err } = result.unwrap();
    if (dep) {
      deps[manager] ??= {};
      deps[manager][packageFileName] ??= [];
      deps[manager][packageFileName].push(dep);
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
      const packageFileDeps = deps[manager]?.[packageFile.packageFile];
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

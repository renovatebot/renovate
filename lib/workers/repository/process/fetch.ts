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
import type { LookupUpdateConfig } from './lookup/types';

async function withLookupStats<T>(
  datasource: string,
  callback: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const result = await callback();
  const duration = Date.now() - start;
  const lookups = memCache.get<LookupStats[]>('lookup-stats') || [];
  lookups.push({ datasource, duration });
  memCache.set('lookup-stats', lookups);
  return result;
}

type LookupResult = Result<PackageDependency, Error>;
type LookupTaskResult = {
  packageFileName: string;
  manager: string;
  result: LookupResult;
};
type LookupTask = () => Promise<LookupTaskResult>;

async function lookup(
  packageFileConfig: ManagerConfig & PackageFile,
  indep: PackageDependency,
): Promise<LookupResult> {
  const dep = clone(indep);
  dep.updates = [];

  if (is.string(dep.depName)) {
    dep.depName = dep.depName.trim();
  }

  dep.packageName ??= dep.depName;
  if (!is.nonEmptyString(dep.packageName)) {
    dep.skipReason = 'invalid-name';
  }

  if (dep.isInternal && !packageFileConfig.updateInternalDeps) {
    dep.skipReason = 'internal-package';
  }

  if (dep.skipReason) {
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
  } else if (depConfig.enabled === false) {
    logger.debug(`Dependency: ${depName!}, is disabled`);
    dep.skipReason = 'disabled';
  } else {
    if (depConfig.datasource) {
      const { val: updateResult, err } = await withLookupStats(
        depConfig.datasource,
        () =>
          Result.wrap(lookupUpdates(depConfig as LookupUpdateConfig)).unwrap(),
      );

      if (updateResult) {
        Object.assign(dep, updateResult);
      } else {
        if (
          packageFileConfig.repoIsOnboarded === true ||
          !(err instanceof ExternalHostError)
        ) {
          return Result.err(err);
        }

        const cause = err.err;
        dep.warnings ??= [];
        dep.warnings.push({
          topic: 'Lookup Error',
          // TODO: types (#22198)
          message: `${depName!}: ${cause.message}`,
        });
      }
    }
    dep.updates ??= [];
  }

  return Result.ok(dep);
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
  const allTasks = createLookupTasks(config, managerPackageFiles);

  const fetchResults = await p.all(allTasks, { concurrency: 25 });

  const collectedDeps: Record<string, Record<string, PackageDependency[]>> = {};
  const collectedErrors: Error[] = [];
  for (const { packageFileName, manager, result } of fetchResults) {
    const { val: dep, err } = result.unwrap();
    if (dep) {
      collectedDeps[manager] ??= {};
      collectedDeps[manager][packageFileName] ??= [];
      collectedDeps[manager][packageFileName].push(dep);
    } else {
      collectedErrors.push(err);
    }
  }

  if (collectedErrors.length) {
    p.handleMultipleErrors(collectedErrors);
  }

  for (const [manager, packageFiles] of Object.entries(managerPackageFiles)) {
    for (const packageFile of packageFiles) {
      const deps = collectedDeps[manager]?.[packageFile.packageFile];
      if (deps) {
        packageFile.deps = deps;
      }
    }
  }

  PackageFiles.add(config.baseBranch!, { ...managerPackageFiles });
  logger.debug(
    { baseBranch: config.baseBranch },
    'Package releases lookups complete',
  );
}

// TODO #22198
import is from '@sindresorhus/is';
import AggregateError from 'aggregate-error';
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

type FetchResult = Result<PackageDependency, Error>;
type FetchTaskResult = {
  packageFile: string;
  manager: string;
  result: FetchResult;
};
type FetchTask = () => Promise<FetchTaskResult>;

async function fetchDepUpdates(
  packageFileConfig: RenovateConfig & PackageFile,
  indep: PackageDependency,
): Promise<FetchResult> {
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

function fetchManagerPackageFileUpdates(
  config: RenovateConfig,
  managerConfig: ManagerConfig,
  pFile: PackageFile,
): FetchTask[] {
  const packageFileConfig = mergeChildConfig(managerConfig, pFile);
  if (pFile.extractedConstraints) {
    packageFileConfig.constraints = {
      ...pFile.extractedConstraints,
      ...config.constraints,
    };
  }

  const tasks: FetchTask[] = pFile.deps.map((dep) => async () => ({
    packageFile: pFile.packageFile,
    manager: managerConfig.manager,
    result: await fetchDepUpdates(packageFileConfig, dep),
  }));

  return tasks;
}

function fetchManagerUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
  manager: string,
): FetchTask[] {
  const managerConfig = getManagerConfig(config, manager);
  const managerPackageFiles = packageFiles[manager];
  return managerPackageFiles
    .map((pFile) =>
      fetchManagerPackageFileUpdates(config, managerConfig, pFile),
    )
    .flat();
}

export async function fetchUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<void> {
  const managers = Object.keys(packageFiles);
  const allTasks = managers
    .map((manager) => fetchManagerUpdates(config, packageFiles, manager))
    .flat();

  const fetchResults = await p.all(allTasks, { concurrency: 25 });

  const collectedDeps: Record<string, Record<string, PackageDependency[]>> = {};
  const collectedErrors: Error[] = [];
  for (const { packageFile, manager, result } of fetchResults) {
    const { val: dep, err } = result.unwrap();
    if (dep) {
      collectedDeps[manager] ??= {};
      collectedDeps[manager][packageFile] ??= [];
      collectedDeps[manager][packageFile].push(dep);
    } else {
      collectedErrors.push(err);
    }
  }

  if (collectedErrors.length) {
    const aggregateError = new AggregateError(collectedErrors);
    p.handleError(aggregateError);
  }

  for (const manager of managers) {
    for (const pFile of packageFiles[manager]) {
      const deps = collectedDeps[manager]?.[pFile.packageFile];
      if (deps) {
        pFile.deps = deps;
      }
    }
  }

  PackageFiles.add(config.baseBranch!, { ...packageFiles });
  logger.debug(
    { baseBranch: config.baseBranch },
    'Package releases lookups complete',
  );
}

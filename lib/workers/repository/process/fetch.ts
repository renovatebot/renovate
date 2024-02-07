// TODO #22198
import is from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { RenovateConfig } from '../../../config/types';
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

async function fetchDepUpdates(
  packageFileConfig: RenovateConfig & PackageFile,
  indep: PackageDependency,
): Promise<PackageDependency> {
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
    return dep;
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
      try {
        const updateResult = await withLookupStats(depConfig.datasource, () =>
          lookupUpdates(depConfig as LookupUpdateConfig),
        );
        Object.assign(dep, updateResult);
      } catch (err) {
        if (
          packageFileConfig.repoIsOnboarded === true ||
          !(err instanceof ExternalHostError)
        ) {
          throw err;
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
  return dep;
}

async function fetchManagerPackagerFileUpdates(
  config: RenovateConfig,
  managerConfig: RenovateConfig,
  pFile: PackageFile,
): Promise<void> {
  const { packageFile } = pFile;
  const packageFileConfig = mergeChildConfig(managerConfig, pFile);
  if (pFile.extractedConstraints) {
    packageFileConfig.constraints = {
      ...pFile.extractedConstraints,
      ...config.constraints,
    };
  }
  const { manager } = packageFileConfig;
  const queue = pFile.deps.map(
    (dep) => (): Promise<PackageDependency> =>
      fetchDepUpdates(packageFileConfig, dep),
  );
  logger.trace(
    { manager, packageFile, queueLength: queue.length },
    'fetchManagerPackagerFileUpdates starting with concurrency',
  );

  pFile.deps = await p.all(queue);
  logger.trace({ packageFile }, 'fetchManagerPackagerFileUpdates finished');
}

async function fetchManagerUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
  manager: string,
): Promise<void> {
  const managerConfig = getManagerConfig(config, manager);
  const queue = packageFiles[manager].map(
    (pFile) => (): Promise<void> =>
      fetchManagerPackagerFileUpdates(config, managerConfig, pFile),
  );
  logger.trace(
    { manager, queueLength: queue.length },
    'fetchManagerUpdates starting',
  );
  await p.all(queue);
  logger.trace({ manager }, 'fetchManagerUpdates finished');
}

export async function fetchUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<void> {
  const managers = Object.keys(packageFiles);
  const allManagerJobs = managers.map((manager) =>
    fetchManagerUpdates(config, packageFiles, manager),
  );
  await Promise.all(allManagerJobs);
  PackageFiles.add(config.baseBranch!, { ...packageFiles });
  logger.debug(
    { baseBranch: config.baseBranch },
    'Package releases lookups complete',
  );
}

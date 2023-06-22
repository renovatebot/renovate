// TODO #7154
import is from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import {
  getDefaultConfig,
  getDefaultVersioning,
} from '../../../modules/datasource';
import type {
  PackageDependency,
  PackageFile,
} from '../../../modules/manager/types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as memCache from '../../../util/cache/memory';
import type { LookupStats } from '../../../util/cache/memory/types';
import { applyPackageRules } from '../../../util/package-rules';
import * as p from '../../../util/promises';
import { lookupUpdates } from './lookup';
import type { LookupUpdateConfig } from './lookup/types';

async function withLookupStats<T>(
  datasource: string,
  callback: () => Promise<T>
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
  indep: PackageDependency
): Promise<PackageDependency> {
  const dep = structuredClone(indep);
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
    // TODO: fix types (#7154)
    logger.debug(`Dependency: ${depName!}, is ignored`);
    dep.skipReason = 'ignored';
  } else if (depConfig.enabled === false) {
    logger.debug(`Dependency: ${depName!}, is disabled`);
    dep.skipReason = 'disabled';
  } else {
    if (depConfig.datasource) {
      try {
        const updateResult = await withLookupStats(depConfig.datasource, () =>
          lookupUpdates(depConfig as LookupUpdateConfig)
        );
        Object.assign(dep, updateResult);
      } catch (err) {
        if (
          packageFileConfig.repoIsOnboarded ||
          !(err instanceof ExternalHostError)
        ) {
          throw err;
        }

        const cause = err.err;
        dep.warnings ??= [];
        dep.warnings.push({
          topic: 'Lookup Error',
          // TODO: types (#7154)
          message: `${depName!}: ${cause.message}`,
        });
      }
    }
    dep.updates ??= [];
  }
  return dep;
}

interface DepUpdateFetchRequest {
  config: RenovateConfig & PackageFile;
  deps: PackageDependency[];
  idx: number;
}

export function depUpdateRequests(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>
): DepUpdateFetchRequest[] {
  const results: DepUpdateFetchRequest[] = [];

  for (const [manager, managerPackageFiles] of Object.entries(packageFiles)) {
    const managerConfig = getManagerConfig(config, manager);

    for (const pFile of managerPackageFiles) {
      const config = mergeChildConfig(managerConfig, pFile);
      if (pFile.extractedConstraints) {
        config.constraints = {
          ...pFile.extractedConstraints,
          ...config.constraints,
        };
      }
      const { deps } = pFile;
      for (let idx = 0; idx < pFile.deps.length; idx += 1) {
        results.push({ config, deps, idx });
      }
    }
  }

  return results;
}

export async function fetchUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>
): Promise<void> {
  const requests = depUpdateRequests(config, packageFiles);
  const tasks = requests.map(({ config, deps, idx }) => async () => {
    const dep = deps[idx];
    deps[idx] = await fetchDepUpdates(config, dep);
  });
  logger.debug(
    { baseBranch: config.baseBranch },
    'Package releases lookups started'
  );
  await p.all(tasks, { concurrency: 20 });
  logger.debug(
    { baseBranch: config.baseBranch },
    'Package releases lookups complete'
  );
}

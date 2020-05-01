import pAll from 'p-all';
import { hrtime } from 'process';
import { logger } from '../../../logger';
import { getPackageUpdates } from '../../../manager';
import {
  ManagerConfig,
  RenovateConfig,
  getManagerConfig,
  mergeChildConfig,
} from '../../../config';
import { applyPackageRules } from '../../../util/package-rules';
import { LookupUpdateConfig, lookupUpdates } from './lookup';
import { PackageDependency, PackageFile } from '../../../manager/common';
import { SkipReason } from '../../../types';
import { getDefaultConfig } from '../../../datasource';
import { clone } from '../../../util/clone';

async function fetchDepUpdates(
  packageFileConfig: ManagerConfig & PackageFile,
  indep: PackageDependency
): Promise<PackageDependency> {
  const dep = clone(indep);
  dep.updates = [];
  if (dep.skipReason) {
    return dep;
  }
  const { manager, packageFile } = packageFileConfig;
  const { depName, currentValue } = dep;
  // TODO: fix types
  let depConfig = mergeChildConfig(packageFileConfig, dep);
  const datasourceDefaultConfig = await getDefaultConfig(depConfig.datasource);
  depConfig = mergeChildConfig(depConfig, datasourceDefaultConfig);
  depConfig = applyPackageRules(depConfig);
  if (depConfig.ignoreDeps.includes(depName)) {
    logger.debug({ dependency: dep.depName }, 'Dependency is ignored');
    dep.skipReason = SkipReason.Ignored;
  } else if (
    depConfig.internalPackages &&
    depConfig.internalPackages.includes(depName)
  ) {
    logger.debug(
      { dependency: dep.depName },
      'Dependency is ignored due to being internal'
    );
    dep.skipReason = SkipReason.InternalPackage;
  } else if (depConfig.enabled === false) {
    logger.debug({ dependency: dep.depName }, 'Dependency is disabled');
    dep.skipReason = SkipReason.Disabled;
  } else {
    if (depConfig.datasource) {
      Object.assign(dep, await lookupUpdates(depConfig as LookupUpdateConfig));
    } else {
      dep.updates = await getPackageUpdates(manager, depConfig);
    }
    dep.updates = dep.updates || [];
    // istanbul ignore if
    if (dep.updates.length) {
      logger.trace(
        { dependency: depName },
        `${dep.updates.length} result(s): ${dep.updates.map(
          (upgrade) => upgrade.newValue
        )}`
      );
    }
    logger.trace({
      packageFile,
      manager,
      depName,
      currentValue,
      updates: dep.updates,
    });
  }
  return dep;
}

async function fetchManagerPackagerFileUpdates(
  config: RenovateConfig,
  managerConfig: ManagerConfig,
  pFile: PackageFile
): Promise<void> {
  const { packageFile } = pFile;
  const packageFileConfig = mergeChildConfig(managerConfig, pFile);
  const { manager } = packageFileConfig;
  const queue = pFile.deps.map((dep) => (): Promise<PackageDependency> =>
    fetchDepUpdates(packageFileConfig, dep)
  );
  logger.trace(
    { manager, packageFile, queueLength: queue.length },
    'fetchManagerPackagerFileUpdates starting with concurrency'
  );
  // eslint-disable-next-line no-param-reassign
  pFile.deps = await pAll(queue, { concurrency: 5 });
  logger.trace({ packageFile }, 'fetchManagerPackagerFileUpdates finished');
}

async function fetchManagerUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
  manager: string
): Promise<void> {
  const managerConfig = getManagerConfig(config, manager);
  const queue = packageFiles[manager].map((pFile) => (): Promise<void> =>
    fetchManagerPackagerFileUpdates(config, managerConfig, pFile)
  );
  logger.trace(
    { manager, queueLength: queue.length },
    'fetchManagerUpdates starting'
  );
  await pAll(queue, { concurrency: 5 });
  logger.trace({ manager }, 'fetchManagerUpdates finished');
}

export async function fetchUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>
): Promise<void> {
  const managers = Object.keys(packageFiles);
  const startTime = hrtime();
  const allManagerJobs = managers.map((manager) =>
    fetchManagerUpdates(config, packageFiles, manager)
  );
  await Promise.all(allManagerJobs);
  const duration = hrtime(startTime);
  const seconds = Math.round(duration[0] + duration[1] / 1e9);
  logger.info({ seconds }, 'Package releases lookups complete');
}

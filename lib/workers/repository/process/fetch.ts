import pAll from 'p-all';
import { logger } from '../../../logger';
import { getPackageUpdates } from '../../../manager';
import {
  getManagerConfig,
  mergeChildConfig,
  RenovateConfig,
  ManagerConfig,
} from '../../../config';
import { applyPackageRules } from '../../../util/package-rules';
import { lookupUpdates, LookupUpdateConfig } from './lookup';
import { PackageFile, PackageDependency } from '../../../manager/common';
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
  const stats = {
    managers: {},
    fileCount: 0,
    depCount: 0,
  };
  for (const [manager, managerPackageFiles] of Object.entries(packageFiles)) {
    const fileCount = managerPackageFiles.length;
    let depCount = 0;
    for (const file of managerPackageFiles) {
      depCount += file.deps.length;
    }
    stats.managers[manager] = {
      fileCount,
      depCount,
    };
    stats.fileCount += fileCount;
    stats.depCount += depCount;
  }
  logger.info({ stats }, `Extraction statistics`);
  const allManagerJobs = managers.map((manager) =>
    fetchManagerUpdates(config, packageFiles, manager)
  );
  await Promise.all(allManagerJobs);
  logger.debug('fetchUpdates complete');
}

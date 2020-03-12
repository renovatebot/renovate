import is from '@sindresorhus/is';
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
import { lookupUpdates, LookupUpdateConfig, UpdateResult } from './lookup';
import {
  PackageFile,
  PackageDependency,
  PackageUpdateResult,
} from '../../../manager/common';
import { SkipReason } from '../../../types';

async function fetchDepUpdates(
  packageFileConfig: ManagerConfig & PackageFile,
  dep: PackageDependency
): Promise<void> {
  /* eslint-disable no-param-reassign */
  dep.updates = [];
  if (dep.skipReason) {
    return;
  }
  const { manager, packageFile } = packageFileConfig;
  const { depName, currentValue } = dep;
  // TODO: fix types
  let depConfig = mergeChildConfig(packageFileConfig, dep);
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
    let lookupResults: UpdateResult | PackageUpdateResult[];
    if (depConfig.datasource) {
      lookupResults = await lookupUpdates(depConfig as LookupUpdateConfig);
    } else {
      lookupResults = await getPackageUpdates(manager, depConfig);
    }
    // istanbul ignore else
    if (is.array(lookupResults)) {
      dep.updates = lookupResults;
    } else {
      Object.assign(dep, lookupResults);
    }
    // istanbul ignore if
    if (dep.updates.length) {
      logger.trace(
        { dependency: depName },
        `${dep.updates.length} result(s): ${dep.updates.map(
          upgrade => upgrade.newValue
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
    logger.debug({ packageFile, depName }, 'fetchDepUpdates finished');
  }
  /* eslint-enable no-param-reassign */
}

async function fetchManagerPackagerFileUpdates(
  config: RenovateConfig,
  managerConfig: ManagerConfig,
  pFile: PackageFile
): Promise<void> {
  const { packageFile } = pFile;
  const packageFileConfig = mergeChildConfig(managerConfig, pFile);
  const { manager } = packageFileConfig;
  const problematicManagers = ['pip_requirements', 'maven'];
  if (problematicManagers.includes(manager)) {
    logger.debug(
      { manager, packageFile, queueLength: pFile.deps.length },
      'fetchManagerPackagerFileUpdates starting sequentially'
    );
    for (const dep of pFile.deps) {
      await fetchDepUpdates(packageFileConfig, dep);
      logger.debug(
        { manager, packageFile, dependency: dep.depName },
        'fetchDepUpdates done'
      );
    }
  } else {
    const queue = pFile.deps.map(dep => (): Promise<void> =>
      fetchDepUpdates(packageFileConfig, dep)
    );
    logger.debug(
      { manager, packageFile, queueLength: queue.length },
      'fetchManagerPackagerFileUpdates starting with concurrency'
    );
    await pAll(queue, { concurrency: 5 });
  }
  logger.debug({ packageFile }, 'fetchManagerPackagerFileUpdates finished');
}

async function fetchManagerUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
  manager: string
): Promise<void> {
  const managerConfig = getManagerConfig(config, manager);
  const queue = packageFiles[manager].map(pFile => (): Promise<void> =>
    fetchManagerPackagerFileUpdates(config, managerConfig, pFile)
  );
  logger.debug(
    { manager, queueLength: queue.length },
    'fetchManagerUpdates starting'
  );
  await pAll(queue, { concurrency: 5 });
  logger.debug({ manager }, 'fetchManagerUpdates finished');
}

export async function fetchUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>
): Promise<void> {
  const managers = Object.keys(packageFiles);
  logger.debug({ managers }, `process.fetchUpdates()`);
  const allManagerJobs = managers.map(manager =>
    fetchManagerUpdates(config, packageFiles, manager)
  );
  await Promise.all(allManagerJobs);
  logger.debug('fetchUpdates complete');
}

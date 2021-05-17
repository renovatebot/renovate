import pAll from 'p-all';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { ManagerConfig, RenovateConfig } from '../../../config/types';
import { getDefaultConfig } from '../../../datasource';
import { logger } from '../../../logger';
import { getPackageUpdates } from '../../../manager';
import type { PackageDependency, PackageFile } from '../../../manager/types';
import { SkipReason } from '../../../types';
import { clone } from '../../../util/clone';
import { applyPackageRules } from '../../../util/package-rules';
import { lookupUpdates } from './lookup';
import type { LookupUpdateConfig } from './lookup/types';

async function fetchDepUpdates(
  packageFileConfig: ManagerConfig & PackageFile,
  indep: PackageDependency
): Promise<PackageDependency> {
  let dep = clone(indep);
  dep.updates = [];
  if (dep.skipReason) {
    return dep;
  }
  const { depName } = dep;
  // TODO: fix types
  let depConfig = mergeChildConfig(packageFileConfig, dep);
  const datasourceDefaultConfig = await getDefaultConfig(depConfig.datasource);
  depConfig = mergeChildConfig(depConfig, datasourceDefaultConfig);
  depConfig = applyPackageRules(depConfig);
  if (depConfig.ignoreDeps.includes(depName)) {
    logger.debug({ dependency: depName }, 'Dependency is ignored');
    dep.skipReason = SkipReason.Ignored;
  } else if (depConfig.enabled === false) {
    logger.debug({ dependency: depName }, 'Dependency is disabled');
    dep.skipReason = SkipReason.Disabled;
  } else {
    if (depConfig.datasource) {
      dep = {
        ...dep,
        ...(await lookupUpdates(depConfig as LookupUpdateConfig)),
      };
    } else {
      dep = {
        ...dep,
        ...(await getPackageUpdates(packageFileConfig.manager, depConfig)),
      };
    }
    dep.updates = dep.updates || [];
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
  const allManagerJobs = managers.map((manager) =>
    fetchManagerUpdates(config, packageFiles, manager)
  );
  await Promise.all(allManagerJobs);
  logger.debug(
    { baseBranch: config.baseBranch },
    'Package releases lookups complete'
  );
}

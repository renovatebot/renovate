import { getManagerConfig } from '../../../config';
import type { RegExManager, RenovateConfig } from '../../../config/types';
import { getManagerList } from '../../../modules/manager';
import type { WorkerExtractConfig } from '../../types';

export interface FingerprintExtractConfig {
  managerList: Set<string>;
  managers: WorkerExtractConfig[];
}

function getFilteredManagerConfig(
  config: RenovateConfig,
  manager: string,
  regexManagerConfig?: RegExManager
): WorkerExtractConfig {
  let filteredConfig = {} as WorkerExtractConfig;

  // need to merge the fileMatch config option
  const fileMatch = [
    ...(regexManagerConfig?.fileMatch ?? []),
    ...(config.fileMatch ?? []),
  ];

  filteredConfig = {
    ...(regexManagerConfig ?? {}),
    manager,
    fileMatch,
    npmrc: config.npmrc,
    npmrcMerge: config.npmrcMerge,
    enabled: config.enabled,
    ignorePaths: config.ignorePaths ?? [],
    includePaths: config.includePaths ?? [],
    skipInstalls: config.skipInstalls,
    registryAliases: config.registryAliases,
    fileList: [],
  };
  return filteredConfig;
}

export function generateFingerprintConfig(
  config: RenovateConfig
): FingerprintExtractConfig {
  const finalConfig = {} as FingerprintExtractConfig;

  const managerExtractConfigs: WorkerExtractConfig[] = [];
  let managerList = new Set(getManagerList());
  const { enabledManagers } = config;
  if (enabledManagers?.length) {
    managerList = new Set(enabledManagers);
  }
  finalConfig.managerList = managerList;

  for (const manager of managerList) {
    const managerConfig = getManagerConfig(config, manager);
    if (manager === 'regex') {
      for (const regexManager of config.regexManagers ?? []) {
        managerExtractConfigs.push(
          getFilteredManagerConfig(managerConfig, manager, regexManager)
        );
      }
    } else {
      managerExtractConfigs.push(
        getFilteredManagerConfig(managerConfig, manager)
      );
    }
  }

  finalConfig.managers = managerExtractConfigs;
  return finalConfig;
}

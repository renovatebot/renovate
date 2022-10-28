import { mergeChildConfig } from '../../../config';
import type { RenovateConfig } from '../../../config/types';
import { get, getManagerList } from '../../../modules/manager';
import type { WorkerExtractConfig } from '../../types';

export interface FingerprintExtractConfig {
  managerList: Set<string>;
  managers: WorkerExtractConfig[];
}

function getFilteredManagerConfig(
  config: RenovateConfig,
  manager: string
): WorkerExtractConfig {
  let mergedConfig = mergeChildConfig(config, config[manager] as any);
  const language = get(manager, 'language');
  if (language) {
    mergedConfig = mergeChildConfig(mergedConfig, config[language] as any);
  }

  return {
    manager,
    npmrc: mergedConfig.npmrc,
    npmrcMerge: mergedConfig.npmrcMerge,
    enabled: mergedConfig.enabled,
    ignorePaths: mergedConfig.ignorePaths ?? [],
    includePaths: mergedConfig.includePaths ?? [],
    skipInstalls: mergedConfig.skipInstalls,
    registryAliases: mergedConfig.registryAliases,
    fileMatch: mergedConfig.fileMatch ?? [],
    fileList: [],
  };
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
    if (manager === 'regex') {
      for (const managerConfig of config.regexManagers ?? []) {
        managerExtractConfigs.push({
          manager,
          fileList: [],
          enabled: true,
          ...managerConfig,
        });
      }
    } else {
      managerExtractConfigs.push(getFilteredManagerConfig(config, manager));
    }
  }

  // need to handle this differently so as to get all necessary properties of RegExManager
  finalConfig.managers = managerExtractConfigs;
  return finalConfig;
}

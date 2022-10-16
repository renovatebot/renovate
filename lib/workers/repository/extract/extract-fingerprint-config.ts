import type { RenovateConfig } from '../../../config/types';
import { get, getManagerList } from '../../../modules/manager';
import type { WorkerExtractConfig } from '../../types';

export interface FingerprintExtractConfig {
  managerList: string[];
  managers: WorkerExtractConfig[];
}

function getFilteredManagerConfig(
  config: RenovateConfig,
  manager: string
): WorkerExtractConfig {
  // the type here is not completely correct because there isn't any defined type only for managers
  const managerConfig: WorkerExtractConfig = config[manager] as any;
  const language = get(manager, 'language');
  // the type here is not completely correct because there isn't any defined type only for languages
  const languageConfig = (
    language ? (config[language] ? config[language] : {}) : {}
  ) as WorkerExtractConfig;
  const filteredConfig = {} as WorkerExtractConfig;

  filteredConfig.manager = manager;
  filteredConfig.npmrc = config.npmrc;
  filteredConfig.npmrcMerge = config.npmrcMerge;

  // non-mergeable config options
  filteredConfig.enabled = managerConfig?.enabled ?? config.enabled;
  filteredConfig.ignorePaths = managerConfig?.ignorePaths ?? [];
  filteredConfig.includePaths =
    managerConfig?.includePaths ?? config.includePaths ?? [];
  filteredConfig.registryAliases = {
    ...config.registryAliases,
    ...(managerConfig?.registryAliases ?? {}),
  };
  filteredConfig.skipInstalls =
    managerConfig?.skipInstalls ?? config.skipInstalls;

  // mergeable config options
  filteredConfig.fileMatch = [...(managerConfig?.fileMatch ?? [])].concat(
    ...(languageConfig?.fileMatch ?? [])
  );

  return filteredConfig;
}

export function generateFingerprintConfig(
  config: RenovateConfig
): FingerprintExtractConfig {
  const finalConfig = {} as FingerprintExtractConfig;

  const managerExtractConfigs: WorkerExtractConfig[] = [];
  let managerList = getManagerList();
  const { enabledManagers } = config;
  if (enabledManagers?.length) {
    managerList = managerList.filter((manager) =>
      enabledManagers.includes(manager)
    );

    if (enabledManagers.includes('regex') && config.regexManagers?.length) {
      for (const manager of config.regexManagers) {
        managerExtractConfigs.push({
          manager: 'regex',
          fileList: [],
          ...manager,
        });
      }
    }
  }
  finalConfig.managerList = managerList;

  for (const manager of managerList) {
    managerExtractConfigs.push(getFilteredManagerConfig(config, manager));
  }

  // need to handle this different so as to get all necessary properties of RegExManager
  finalConfig.managers = managerExtractConfigs;
  return finalConfig;
}

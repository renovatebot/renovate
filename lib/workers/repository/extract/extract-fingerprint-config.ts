import type { RenovateConfig } from '../../../config/types';
import { get, getManagerList } from '../../../modules/manager';
import type { WorkerExtractConfig } from '../../types';

export interface FingerprintExtractConfig
  extends Omit<WorkerExtractConfig, 'manager' | 'fileList'> {
  manager?: string;
  fileList?: string[];
}

export function extractFingerprintConfig(
  config: RenovateConfig
): FingerprintExtractConfig[] {
  const managerExtractConfigs: FingerprintExtractConfig[] = [
    ...((config.regexManagers ?? []) as FingerprintExtractConfig[]),
  ];

  let managerList = getManagerList();
  const { enabledManagers } = config;
  if (enabledManagers?.length) {
    managerList = managerList.filter((manager) =>
      enabledManagers.includes(manager)
    );
  }

  for (const manager of managerList) {
    const managerConfig: WorkerExtractConfig = config[manager] as any;
    const language = get(manager, 'language');
    const languageConfig = (
      language ? (config[language] ? config[language] : {}) : {}
    ) as FingerprintExtractConfig;
    const filteredConfig = {} as FingerprintExtractConfig;

    // npmrc and npmrcMerge
    if (manager === 'npm') {
      filteredConfig.npmrc = config?.npmrc;
      filteredConfig.npmrcMerge = config?.npmrcMerge;
    }

    // non-mergeable config options
    filteredConfig.enabled = managerConfig?.enabled;
    filteredConfig.ignorePaths = managerConfig?.ignorePaths;
    filteredConfig.includePaths = config?.includePaths;
    filteredConfig.registryAliases = managerConfig?.registryAliases;
    filteredConfig.skipInstalls = managerConfig?.skipInstalls;

    // mergeable config options
    filteredConfig.fileMatch = [...(managerConfig?.fileMatch ?? [])].concat(
      ...(languageConfig?.fileMatch ?? [])
    );

    managerExtractConfigs.push(filteredConfig);
  }

  return managerExtractConfigs;
}

import { getManagerConfig, mergeChildConfig } from '../../../config';
import type {
  RegexManagerTemplates,
  RenovateConfig,
} from '../../../config/types';
import { getManagerList } from '../../../modules/manager';
import { getCustomManagerList } from '../../../modules/manager/custom';
import { validMatchFields } from '../../../modules/manager/custom/regex/utils';
import type { CustomExtractConfig } from '../../../modules/manager/types';
import type { WorkerExtractConfig } from '../../types';

export interface FingerprintExtractConfig {
  managerList: Set<string>;
  managers: WorkerExtractConfig[];
}

function getRegexManagerFields(
  config: WorkerExtractConfig
): CustomExtractConfig {
  const regexFields = {} as CustomExtractConfig;
  for (const field of validMatchFields.map(
    (f) => `${f}Template` as keyof RegexManagerTemplates
  )) {
    if (config[field]) {
      regexFields[field] = config[field];
    }
  }

  return {
    autoReplaceStringTemplate: config.autoReplaceStringTemplate,
    matchStrings: config.matchStrings,
    matchStringsStrategy: config.matchStringsStrategy,
    ...regexFields,
  };
}

function getFilteredManagerConfig(
  config: WorkerExtractConfig
): WorkerExtractConfig {
  return {
    ...(config.manager.startsWith('custom.') && getRegexManagerFields(config)),
    manager: config.manager,
    fileMatch: config.fileMatch,
    npmrc: config.npmrc,
    npmrcMerge: config.npmrcMerge,
    enabled: config.enabled,
    ignorePaths: config.ignorePaths ?? [],
    includePaths: config.includePaths ?? [],
    skipInstalls: config.skipInstalls,
    registryAliases: config.registryAliases,
    fileList: [],
  };
}

export function generateFingerprintConfig(
  config: RenovateConfig
): FingerprintExtractConfig {
  const managerExtractConfigs: WorkerExtractConfig[] = [];
  let managerList: Set<string>;
  const { enabledManagers } = config;
  if (enabledManagers?.length) {
    managerList = new Set(enabledManagers);
  } else {
    managerList = new Set(getManagerList());
  }

  const handleCustomManager = (
    config: RenovateConfig,
    manager: string
  ): void => {
    // TODO: filter config.regexManagers (manager === customType)
    for (const regexManager of config.regexManagers ?? []) {
      const customManagerConfig = getManagerConfig(config, manager);
      managerExtractConfigs.push({
        ...mergeChildConfig(customManagerConfig, regexManager),
        fileList: [],
      });
    }
  };

  for (const manager of managerList) {
    if (manager === 'custom') {
      for (const customManager of getCustomManagerList()) {
        handleCustomManager(config, 'custom.' + customManager);
      }
    } else if (manager.startsWith('custom.')) {
      handleCustomManager(config, 'custom.' + manager);
    } else {
      const managerConfig = getManagerConfig(config, manager);
      managerExtractConfigs.push({ ...managerConfig, fileList: [] });
    }
  }

  return {
    managerList,
    managers: managerExtractConfigs.map(getFilteredManagerConfig),
  };
}

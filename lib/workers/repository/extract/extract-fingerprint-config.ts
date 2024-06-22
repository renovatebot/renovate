import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { RenovateConfig } from '../../../config/types';
import { getEnabledManagersList } from '../../../modules/manager';
import { isCustomManager } from '../../../modules/manager/custom';
import type { RegexManagerTemplates } from '../../../modules/manager/custom/regex/types';
import { validMatchFields } from '../../../modules/manager/custom/regex/utils';
import type { CustomExtractConfig } from '../../../modules/manager/custom/types';
import type { WorkerExtractConfig } from '../../types';

export interface FingerprintExtractConfig {
  managerList: Set<string>;
  managers: WorkerExtractConfig[];
}

// checks for regex manager fields
function getCustomManagerFields(
  config: WorkerExtractConfig,
): CustomExtractConfig {
  const regexFields = {} as CustomExtractConfig;
  for (const field of validMatchFields.map(
    (f) => `${f}Template` as keyof RegexManagerTemplates,
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
  config: WorkerExtractConfig,
): WorkerExtractConfig {
  return {
    ...(isCustomManager(config.manager) && getCustomManagerFields(config)),
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
  config: RenovateConfig,
): FingerprintExtractConfig {
  const managerExtractConfigs: WorkerExtractConfig[] = [];
  const managerList = new Set(getEnabledManagersList(config.enabledManagers));

  for (const manager of managerList) {
    const managerConfig = getManagerConfig(config, manager);
    if (isCustomManager(manager)) {
      const filteredCustomManagers = (config.customManagers ?? []).filter(
        (mgr) => mgr.customType === manager,
      );
      for (const customManager of filteredCustomManagers) {
        managerExtractConfigs.push({
          ...mergeChildConfig(managerConfig, customManager),
          fileList: [],
        });
      }
    } else {
      managerExtractConfigs.push({ ...managerConfig, fileList: [] });
    }
  }

  return {
    managerList,
    managers: managerExtractConfigs.map(getFilteredManagerConfig),
  };
}

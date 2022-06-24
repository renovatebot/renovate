import { logger } from '../logger';
import { get, getLanguageList, getManagerList } from '../modules/manager';
import * as options from './options';
import type {
  AllConfig,
  ManagerConfig,
  RenovateConfig,
  RenovateConfigStage,
} from './types';
import { mergeChildConfig } from './utils';

export { mergeChildConfig };

export function getManagerConfig(
  config: RenovateConfig,
  manager: string
): ManagerConfig {
  let managerConfig: ManagerConfig = {
    ...config,
    language: null,
    manager,
  };
  const language = get(manager, 'language');
  if (language) {
    // TODO: fix types #7154
    managerConfig = mergeChildConfig(managerConfig, config[language] as any);
    managerConfig.language = language;
  }
  // TODO: fix types #7154
  managerConfig = mergeChildConfig(managerConfig, config[manager] as any);
  for (const i of getLanguageList().concat(getManagerList())) {
    delete managerConfig[i];
  }
  return managerConfig;
}

export function filterConfig(
  inputConfig: AllConfig,
  targetStage: RenovateConfigStage
): AllConfig {
  logger.trace({ config: inputConfig }, `filterConfig('${targetStage}')`);
  const outputConfig: RenovateConfig = { ...inputConfig };
  const stages: (string | undefined)[] = [
    'global',
    'repository',
    'package',
    'branch',
    'pr',
  ];
  const targetIndex = stages.indexOf(targetStage);
  for (const option of options.getOptions()) {
    const optionIndex = stages.indexOf(option.stage);
    if (optionIndex !== -1 && optionIndex < targetIndex) {
      delete outputConfig[option.name];
    }
  }
  return outputConfig;
}

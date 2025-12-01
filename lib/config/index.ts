import { logger } from '../logger';
import { allManagersList, get } from '../modules/manager';
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
  manager: string,
): ManagerConfig {
  let managerConfig: ManagerConfig = {
    ...config,
    manager,
  };
  const categories = get(manager, 'categories');
  if (categories) {
    managerConfig.categories = categories;
  }
  // TODO: fix types #22198
  // @ts-expect-error -- not easily typed
  managerConfig = mergeChildConfig(managerConfig, config[manager] as any);
  for (const i of allManagersList) {
    // @ts-expect-error -- not easily typed
    delete managerConfig[i];
  }
  return managerConfig;
}

export function removeGlobalConfig(
  config: RenovateConfig,
  keepInherited: boolean,
): RenovateConfig {
  const outputConfig: RenovateConfig = { ...config };
  for (const option of options.getOptions()) {
    if (keepInherited && option.inheritConfigSupport) {
      continue;
    }
    if (option.globalOnly) {
      // @ts-expect-error -- not easily typed
      delete outputConfig[option.name];
    }
  }
  return outputConfig;
}

export function filterConfig<T extends AllConfig = AllConfig>(
  inputConfig: T,
  targetStage: RenovateConfigStage,
): T {
  logger.trace({ config: inputConfig }, `filterConfig('${targetStage}')`);
  const outputConfig: T = { ...inputConfig };
  const stages: (string | undefined)[] = [
    'global',
    'inherit',
    'repository',
    'package',
    'branch',
    'pr',
  ];
  const targetIndex = stages.indexOf(targetStage);
  for (const option of options.getOptions()) {
    const optionIndex = stages.indexOf(option.stage);
    if (optionIndex !== -1 && optionIndex < targetIndex) {
      // @ts-expect-error -- not easily typed
      delete outputConfig[option.name];
    }
  }
  return outputConfig;
}

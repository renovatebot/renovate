import type { RenovateConfig } from '../../../config/types';
import { get, getManagerList, hashMap } from '../../../modules/manager';

export function extractFingerprintConfig(config: RenovateConfig): unknown {
  // collect manager configs
  let managerList = getManagerList();
  const { enabledManagers } = config;
  if (enabledManagers?.length) {
    managerList = managerList.filter((manager) =>
      enabledManagers.includes(manager)
    );
  }

  // collect language configs
  const languageConfigArray = managerList
    .map((manager) => {
      const language = get(manager, 'language');
      if (language) {
        return config[language];
      }
      return undefined;
    })
    .filter(Boolean);

  return {
    npmrc: config.npmrc,
    npmrcMerge: config.npmrcMerge,
    regexManagers: config.regexManagers,
    managerConfigList: managerList
      .map((manager) => config[manager])
      .filter(Boolean),
    languageConfigArray,
    managerFingerprints: managerList.map(
      (manager) => hashMap.get(manager) ?? manager
    ),
  };
}

import type { RenovateConfig, RepoGlobalConfig } from './types';

let repoGlobalConfig: RepoGlobalConfig = {};

// TODO: once admin config work is complete, add a test to make sure this list includes all options with admin=true (#9603)
const repoGlobalOptions = [
  'allowCustomCrateRegistries',
  'allowPostUpgradeCommandTemplating',
  'allowScripts',
  'allowedPostUpgradeCommands',
  'binarySource',
  'customEnvVariables',
  'dockerChildPrefix',
  'dockerImagePrefix',
  'dockerUser',
  'dryRun',
  'exposeAllEnv',
  'migratePresets',
  'privateKey',
  'localDir',
  'cacheDir',
];

export function setGlobalConfig(
  config: RenovateConfig | RepoGlobalConfig = {}
): RenovateConfig {
  repoGlobalConfig = {};
  const result = { ...config };
  for (const option of repoGlobalOptions) {
    repoGlobalConfig[option] = config[option];
    delete result[option]; // eslint-disable-line no-param-reassign
  }
  return result;
}

export function getGlobalConfig(): RepoGlobalConfig {
  return repoGlobalConfig;
}

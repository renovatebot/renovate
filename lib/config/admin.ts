import type { RenovateConfig, RepoAdminConfig } from './types';

let adminConfig: RepoAdminConfig = {};

// TODO: once admin config work is complete, add a test to make sure this list includes all options with admin=true (#9603)
const repoAdminOptions = [
  'allowCustomCrateRegistries',
  'allowPostUpgradeCommandTemplating',
  'allowScripts',
  'allowedPostUpgradeCommands',
  'customEnvVariables',
  'dockerChildPrefix',
  'dockerImagePrefix',
  'dockerUser',
  'dryRun',
  'exposeAllEnv',
  'privateKey',
  'localDir',
  'cacheDir',
];

export function setAdminConfig(
  config: RenovateConfig & RepoAdminConfig = {}
): RenovateConfig {
  adminConfig = {};
  const result = { ...config };
  for (const option of repoAdminOptions) {
    adminConfig[option] = config[option];
    delete result[option]; // eslint-disable-line no-param-reassign
  }
  return result;
}

export function getAdminConfig(): RepoAdminConfig {
  return adminConfig;
}

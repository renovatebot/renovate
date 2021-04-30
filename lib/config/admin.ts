import type { RenovateConfig, RepoAdminConfig } from './types';

let adminConfig: RepoAdminConfig = {};

// TODO: once admin config work is complete, add a test to make sure this list includes all options with admin=true (#9603)
export const repoAdminOptions: (keyof RepoAdminConfig)[] = [
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
  'gitNoVerify',
  'privateKey',
];

export function setAdminConfig(config: RenovateConfig = {}): void {
  adminConfig = {};
  for (const option of repoAdminOptions) {
    adminConfig[option as string] = config[option];
    delete config[option]; // eslint-disable-line no-param-reassign
  }
}

export function getAdminConfig(): RepoAdminConfig {
  return adminConfig;
}

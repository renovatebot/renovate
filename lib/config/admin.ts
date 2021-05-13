import type { RenovateConfig, RepoAdminConfig } from './types';

let adminConfig: RepoAdminConfig;

// TODO: once admin config work is complete, add a test to make sure this list includes all options with admin=true (#9603)
const adminDefaults: RepoAdminConfig = {
  allowCustomCrateRegistries: undefined,
  allowPostUpgradeCommandTemplating: undefined,
  allowScripts: undefined,
  allowedPostUpgradeCommands: undefined,
  customEnvVariables: undefined,
  dockerChildPrefix: undefined,
  dockerImagePrefix: undefined,
  dockerUser: undefined,
  dryRun: undefined,
  exposeAllEnv: undefined,
  privateKey: undefined,
  localDir: '',
  cacheDir: '',
};

export function setAdminConfig(config: RenovateConfig = {}): void {
  adminConfig = { ...adminDefaults };
  for (const [key, defaultValue] of Object.entries(adminDefaults)) {
    adminConfig[key] = config[key] ?? defaultValue;
    delete config[key]; // eslint-disable-line no-param-reassign
  }
}

setAdminConfig();

export function getAdminConfig(): RepoAdminConfig {
  return adminConfig;
}

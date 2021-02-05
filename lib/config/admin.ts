import { RenovateConfig, RepoAdminConfig } from './common';

let adminConfig: RepoAdminConfig = {};

const derivedAdminOptions = ['localDir'];

export function setAdminConfig(
  config: RenovateConfig = {},
  adminOptions = Object.keys(config)
): void {
  adminConfig = {};
  const repoAdminOptions = adminOptions.concat(derivedAdminOptions);
  for (const option of repoAdminOptions) {
    adminConfig[option] = config[option];
    // TODO: delete from config
  }
}

export function getAdminConfig(): RepoAdminConfig {
  return adminConfig;
}

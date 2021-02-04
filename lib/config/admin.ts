import { RenovateConfig, RepoAdminConfig } from './common';

let adminConfig: RepoAdminConfig = {};

const derivedAdminOptions = ['localDir'];

export function setAdminConfig(
  config: RenovateConfig,
  adminOptions: string[]
): void {
  adminConfig = {};
  const repoAdminOptions = adminOptions.concat(derivedAdminOptions).sort();
  for (const option of repoAdminOptions) {
    adminConfig[option] = config[option];
  }
}

export function getAdminConfig(): RepoAdminConfig {
  return adminConfig;
}

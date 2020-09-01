import { RenovateConfig } from '../../../config';

export type RepoConfigError = {
  validationError: string;
  validationMessage: string;
};

export interface RepoFileConfig {
  fileName?: string;
  config?: any;
  error?: RepoConfigError;
}

export interface RepoInitConfig {
  defaultBranchSha?: string;
  repoConfig?: RepoFileConfig;
  resolvedConfig?: RenovateConfig;
}
